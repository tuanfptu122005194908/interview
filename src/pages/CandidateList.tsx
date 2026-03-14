import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  interviewer_1: "HR 1",
  interviewer_2: "HR 2",
  interviewer_3: "HR 3",
  viewer: "Viewer",
};

const CandidateList = () => {
  const { role, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Add/Edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data } = await supabase.from("candidates").select("*").order("created_at");
      return data || [];
    },
  });

  const { data: allQuestions = [] } = useQuery({
    queryKey: ["all-questions-list"],
    queryFn: async () => {
      const { data } = await supabase.from("interview_questions").select("*");
      return data || [];
    },
  });

  const getAverage = (candidateId: string) => {
    const qs = allQuestions.filter((q) => q.candidate_id === candidateId && Number(q.score) > 0);
    if (qs.length === 0) return 0;
    return qs.reduce((sum, q) => sum + Number(q.score), 0) / qs.length;
  };

  const nameFromFile = (filename: string) => {
    return filename
      .replace(/\.[^/.]+$/, "")
      .replace(/^\d+_\d*_?/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Ứng viên";
  };

  const uploadCandidates = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf"
    );
    if (fileArr.length === 0) {
      toast.error("Chỉ hỗ trợ file ảnh hoặc PDF");
      return;
    }
    setUploading(true);
    let count = 0;
    for (const file of fileArr) {
      const candidateName = nameFromFile(file.name);
      const { data: newCandidate, error: cErr } = await supabase
        .from("candidates")
        .insert({ name: candidateName, role: "Ứng viên" })
        .select()
        .single();
      if (cErr || !newCandidate) {
        toast.error(`Lỗi tạo "${candidateName}": ${cErr?.message}`);
        continue;
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${newCandidate.id}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from("cv-images").upload(filePath, file);
      if (upErr) {
        toast.error(`Lỗi upload "${file.name}": ${upErr.message}`);
        continue;
      }
      const { data: urlData } = supabase.storage.from("cv-images").getPublicUrl(filePath);
      await supabase.from("cv_images").insert({
        candidate_id: newCandidate.id,
        image_url: urlData.publicUrl,
        sort_order: 0,
      });
      count++;
    }
    if (count > 0) {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast.success(`Đã tạo ${count} ứng viên`);
    }
    setUploading(false);
  }, [queryClient]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadCandidates(e.target.files);
    e.target.value = "";
  }, [uploadCandidates]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) uploadCandidates(e.dataTransfer.files);
  }, [uploadCandidates]);

  const openAddForm = () => {
    setEditingId(null);
    setFormName("");
    setFormRole("");
    setShowForm(true);
  };

  const openEditForm = (c: typeof candidates[0]) => {
    setEditingId(c.id);
    setFormName(c.name);
    setFormRole(c.role);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error("Vui lòng nhập tên"); return; }
    setSaving(true);
    if (editingId) {
      const { error } = await supabase.from("candidates").update({ name: formName.trim(), role: formRole.trim() || "Ứng viên" }).eq("id", editingId);
      if (error) toast.error("Lỗi: " + error.message);
      else toast.success("Đã cập nhật");
    } else {
      const { error } = await supabase.from("candidates").insert({ name: formName.trim(), role: formRole.trim() || "Ứng viên" });
      if (error) toast.error("Lỗi: " + error.message);
      else toast.success("Đã thêm ứng viên");
    }
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
    setSaving(false);
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    // Delete related data first
    await supabase.from("interview_questions").delete().eq("candidate_id", id);
    await supabase.from("interview_scores").delete().eq("candidate_id", id);
    // Delete CV images from storage
    const { data: images } = await supabase.from("cv_images").select("*").eq("candidate_id", id);
    if (images) {
      for (const img of images) {
        const pathMatch = img.image_url.match(/cv-images\/(.+)$/);
        if (pathMatch) await supabase.storage.from("cv-images").remove([pathMatch[1]]);
      }
    }
    await supabase.from("cv_images").delete().eq("candidate_id", id);
    const { error } = await supabase.from("candidates").delete().eq("id", id);
    if (error) toast.error("Lỗi: " + error.message);
    else toast.success("Đã xóa ứng viên");
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
    setDeletingId(null);
  };

  const scoreColor = (v: number) => v >= 8 ? "text-success" : v >= 5 ? "text-primary" : "text-muted-foreground";
  const canManage = role === "viewer" || role?.startsWith("interviewer");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-blue-500/5 rounded-full mix-blend-multiply filter blur-2xl opacity-20"></div>
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full mix-blend-multiply filter blur-2xl opacity-20" style={{ animationDelay: "2s" }}></div>
      </div>

      {/* Header */}
      <header className="z-20 bg-gradient-to-b from-slate-800/95 to-slate-800/70 backdrop-blur-sm border-b border-slate-700/50 sticky top-0">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur-lg opacity-75 group-hover:opacity-100 transition-all duration-300"></div>
              <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-lg font-black">
                IV
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">InterviewOS</h1>
              <p className="text-xs text-slate-400 font-medium">{role ? ROLE_LABELS[role] : "Loading..."}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {role === "viewer" && (
              <button
                onClick={() => window.location.href = "/results"}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-blue-600 rounded-lg opacity-75 group-hover:opacity-100 transition-all duration-300 blur-lg group-hover:blur-xl"></div>
                <div className="relative px-5 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-blue-600 text-white text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95">
                  📊 Kết quả
                </div>
              </button>
            )}
            <button
              onClick={signOut}
              className="px-4 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-all duration-300 text-xs font-semibold border border-slate-700 hover:border-slate-600"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        {/* Upload section */}
        {canManage && (
          <div
            className={`mb-10 group rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer ${
              dragOver
                ? "border-blue-400 bg-blue-500/10 scale-[1.02]"
                : "border-slate-600 hover:border-blue-500/50 hover:bg-slate-700/30"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && document.getElementById("cv-upload-input")?.click()}
          >
            <div className="flex flex-col items-center justify-center py-16">
              {uploading ? (
                <>
                  <div className="relative mb-4">
                    <div className="w-12 h-12 border-4 border-blue-500/20 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-blue-500 border-r-blue-500 rounded-full animate-spin" style={{ animationDuration: '1.5s' }}></div>
                  </div>
                  <p className="text-sm font-bold text-white">Đang upload...</p>
                </>
              ) : (
                <>
                  <div className="relative mb-4">
                    <div className="absolute inset-0 w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-all duration-300"></div>
                    <div className="relative w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl flex items-center justify-center">
                      <svg className="text-blue-400" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                      </svg>
                    </div>
                  </div>
                  <p className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                    {dragOver ? "Thả file vào đây" : "Upload CV để tạo ứng viên"}
                  </p>
                  <p className="text-sm text-slate-400 mt-2">
                    Kéo thả hoặc bấm — mỗi file = 1 ứng viên (ảnh & PDF)
                  </p>
                </>
              )}
            </div>
            <input
              id="cv-upload-input"
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={handleFileInput}
              disabled={uploading}
            />
          </div>
        )}

        {/* Title row */}
        <div className="flex items-end justify-between mb-8 animate-slide-in-up">
          <div>
            <h2 className="text-3xl font-black text-white mb-1 flex items-end gap-2">
              👥 Ứng viên
              <span className="text-lg font-semibold text-slate-400">({candidates.length})</span>
            </h2>
            <p className="text-sm text-slate-400">Quản lý hồ sơ và điểm phỏng vấn</p>
          </div>
          {canManage && (
            <button
              onClick={openAddForm}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg opacity-75 group-hover:opacity-100 transition-all duration-300 blur-lg group-hover:blur-xl"></div>
              <div className="relative px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2 transition-all hover:scale-105 active:scale-95">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                Thêm ứng viên
              </div>
            </button>
          )}
        </div>

        {/* Candidates list */}
        <div className="space-y-4">
          {candidates.map((candidate, idx) => {
            const avg = getAverage(candidate.id);
            const qCount = allQuestions.filter((q) => q.candidate_id === candidate.id).length;
            return (
              <div
                key={candidate.id}
                style={{ animationDelay: `${idx * 0.05}s` }}
                className="group animate-slide-in-up"
              >
                <Link
                  to={`/candidate/${candidate.id}`}
                  className="flex items-center justify-between px-6 py-5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 border border-slate-700 group-hover:border-blue-500/50 transition-all duration-300 hover-lift hover:shadow-2xl"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg opacity-0 group-hover:opacity-75 transition-all duration-300 blur-lg"></div>
                      <div className="relative w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg font-bold text-white">
                        {candidate.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                        {candidate.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {candidate.role} <span className="text-slate-600">•</span> {qCount} câu hỏi
                      </p>
                    </div>
                  </div>

                  {/* Score badge */}
                  <div className="flex items-center gap-6 ml-4">
                    <div className="text-right">
                      <div className={`text-2xl font-black tabular-nums transition-all ${
                        avg > 0 ? scoreColor(avg) : "text-slate-500"
                      }`}>
                        {avg > 0 ? avg.toFixed(1) : "—"}
                      </div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-black">Điểm TB</p>
                    </div>

                    {/* Action buttons */}
                    {canManage && (
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.preventDefault(); openEditForm(candidate); }}
                          className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 transition-all duration-200"
                          title="Sửa"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); setDeletingId(candidate.id); }}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700/50 transition-all duration-200"
                          title="Xóa"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
                        </button>
                      </div>
                    )}

                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-500 group-hover:text-blue-400 transition-colors">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
                </Link>
              </div>
            );
          })}

          {candidates.length === 0 && (
            <div className="px-8 py-16 text-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-700">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 bg-slate-600 rounded-2xl blur-lg opacity-50"></div>
                <div className="relative w-20 h-20 bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl flex items-center justify-center text-3xl">
                  👥
                </div>
              </div>
              <p className="text-lg font-bold text-white">Chưa có ứng viên nào</p>
              <p className="text-sm text-slate-400 mt-2">Upload CV hoặc thêm ứng viên thủ công để bắt đầu</p>
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-fade-in-scale" onClick={() => setShowForm(false)}>
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-600 animate-bounce-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-black text-white mb-6">
              {editingId ? "✏️ Chỉnh sửa ứng viên" : "➕ Thêm ứng viên mới"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-2">Họ tên</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700/50 backdrop-blur-sm px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  placeholder="Nguyễn Văn A"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-2">Vị trí ứng tuyển</label>
                <input
                  type="text"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700/50 backdrop-blur-sm px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  placeholder="Frontend Developer"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-7">
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 transition-all border border-slate-600"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg opacity-75 group-hover:opacity-100 transition-all duration-300 blur-lg group-hover:blur-xl"></div>
                <div className="relative px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50">
                  {saving ? "Đang lưu..." : editingId ? "Cập nhật" : "Thêm"}
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-fade-in-scale" onClick={() => setDeletingId(null)}>
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl shadow-2xl p-8 w-full max-w-sm border border-slate-600 animate-bounce-in" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center justify-center mb-5">
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="text-xl font-black text-white mb-2">Xóa ứng viên?</h3>
            <p className="text-sm text-slate-400 mb-7">Tất cả dữ liệu liên quan (câu hỏi, điểm, CV) sẽ bị xóa vĩnh viễn.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 transition-all border border-slate-600"
              >
                Hủy
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold uppercase tracking-wider transition-all"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateList;
