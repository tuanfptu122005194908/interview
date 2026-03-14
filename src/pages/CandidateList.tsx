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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border/60 sticky top-0 z-30 backdrop-blur-sm bg-card/95">
        <div className="mx-auto max-w-6xl px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-sm">
              IV
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground tracking-tight">InterviewOS</h1>
              <p className="text-[11px] text-muted-foreground font-medium">{role ? ROLE_LABELS[role] : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {role === "viewer" && (
              <Link
                to="/results"
                className="text-xs font-semibold text-primary-foreground gradient-primary px-4 py-2 rounded-lg hover:opacity-90 transition-all shadow-sm"
              >
                Kết quả
              </Link>
            )}
            <button
              onClick={signOut}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Upload area */}
        {canManage && (
          <div
            className={`mb-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border/60 hover:border-primary/40 hover:bg-card"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && document.getElementById("cv-upload-input")?.click()}
          >
            <div className="flex flex-col items-center justify-center py-10">
              {uploading ? (
                <>
                  <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm font-semibold text-foreground">Đang upload...</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                    <svg className="text-primary" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {dragOver ? "Thả file vào đây" : "Upload CV để tạo ứng viên"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
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
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-foreground">Ứng viên</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{candidates.length} người</p>
          </div>
          {canManage && (
            <button
              onClick={openAddForm}
              className="text-xs font-semibold text-primary-foreground gradient-primary px-4 py-2 rounded-lg hover:opacity-90 transition-all shadow-sm flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Thêm ứng viên
            </button>
          )}
        </div>

        {/* Add/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setShowForm(false)}>
            <div className="bg-card rounded-2xl shadow-elevated p-6 w-full max-w-md mx-4 border border-border/50" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-bold text-foreground mb-5">
                {editingId ? "Chỉnh sửa ứng viên" : "Thêm ứng viên mới"}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Họ tên</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40 transition-all"
                    placeholder="Nguyễn Văn A"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Vị trí ứng tuyển</label>
                  <input
                    type="text"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-primary/40 transition-all"
                    placeholder="Frontend Developer"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-primary-foreground gradient-primary rounded-lg hover:opacity-90 transition-all disabled:opacity-50 shadow-sm"
                >
                  {saving ? "Đang lưu..." : editingId ? "Cập nhật" : "Thêm"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setDeletingId(null)}>
            <div className="bg-card rounded-2xl shadow-elevated p-6 w-full max-w-sm mx-4 border border-border/50" onClick={(e) => e.stopPropagation()}>
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--destructive))" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">Xóa ứng viên?</h3>
              <p className="text-sm text-muted-foreground mb-5">Tất cả dữ liệu liên quan (câu hỏi, điểm, CV) sẽ bị xóa vĩnh viễn.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeletingId(null)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-all">
                  Hủy
                </button>
                <button onClick={() => handleDelete(deletingId)} className="px-4 py-2 text-sm font-semibold text-destructive-foreground bg-destructive rounded-lg hover:opacity-90 transition-all shadow-sm">
                  Xóa
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Candidates list */}
        <div className="space-y-2.5">
          {candidates.map((candidate) => {
            const avg = getAverage(candidate.id);
            const qCount = allQuestions.filter((q) => q.candidate_id === candidate.id).length;
            return (
              <div
                key={candidate.id}
                className="flex items-center justify-between px-5 py-4 rounded-2xl bg-card shadow-card hover:shadow-card-hover border border-transparent hover:border-primary/8 transition-all duration-200 group"
              >
                <Link
                  to={`/candidate/${candidate.id}`}
                  className="flex items-center gap-4 flex-1 min-w-0"
                >
                  <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground shadow-sm shrink-0">
                    {candidate.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{candidate.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{candidate.role} • {qCount} câu hỏi</p>
                  </div>
                </Link>
                <div className="flex items-center gap-3">
                  <div className="text-right mr-2">
                    <p className={`text-xl font-extrabold tabular-nums ${avg > 0 ? scoreColor(avg) : "text-muted-foreground/30"}`}>
                      {avg > 0 ? avg.toFixed(1) : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Điểm TB</p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.preventDefault(); openEditForm(candidate); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/8 transition-all"
                        title="Sửa"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); setDeletingId(candidate.id); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all"
                        title="Xóa"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                  )}
                  <Link to={`/candidate/${candidate.id}`} className="text-muted-foreground/30 group-hover:text-primary/50 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </Link>
                </div>
              </div>
            );
          })}
          {candidates.length === 0 && (
            <div className="px-6 py-16 text-center rounded-2xl bg-card shadow-card border border-border/30">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <p className="text-sm font-medium text-foreground">Chưa có ứng viên nào</p>
              <p className="text-xs text-muted-foreground mt-1">Upload CV hoặc thêm ứng viên thủ công</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CandidateList;
