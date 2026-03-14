import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ROLE_LABELS: Record<string, string> = {
  interviewer_1: "HR 1",
  interviewer_2: "HR 2",
  interviewer_3: "HR 3",
};

const ROLE_COLORS: Record<string, string> = {
  interviewer_1: "gradient-primary",
  interviewer_2: "bg-accent",
  interviewer_3: "bg-success",
};

const ROLE_DOT_COLORS: Record<string, string> = {
  interviewer_1: "bg-primary",
  interviewer_2: "bg-accent",
  interviewer_3: "bg-success",
};

const CandidateDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const isInterviewer = role?.startsWith("interviewer");
  const isViewer = role === "viewer";

  // Edit candidate state
  const [editingCandidate, setEditingCandidate] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");

  const { data: candidate } = useQuery({
    queryKey: ["candidate", id],
    queryFn: async () => {
      const { data } = await supabase.from("candidates").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: cvImages = [] } = useQuery({
    queryKey: ["cv-images", id],
    queryFn: async () => {
      const { data } = await supabase.from("cv_images").select("*").eq("candidate_id", id!).order("sort_order");
      return data || [];
    },
    enabled: !!id,
  });

  const { data: allQuestions = [] } = useQuery({
    queryKey: ["questions", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("interview_questions")
        .select("*")
        .eq("candidate_id", id!)
        .order("created_at");
      return data || [];
    },
    enabled: !!id,
  });

  // Realtime
  useEffect(() => {
    if (!id) return;
    const ch1 = supabase
      .channel(`q-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "interview_questions", filter: `candidate_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["questions", id] });
      })
      .subscribe();
    const ch2 = supabase
      .channel(`cv-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cv_images", filter: `candidate_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["cv-images", id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [id, queryClient]);

  const myQuestions = allQuestions.filter((q) => q.interviewer_role === role);
  const [newQuestionsText, setNewQuestionsText] = useState("");
  const [localScores, setLocalScores] = useState<Record<string, number>>({});

  useEffect(() => {
    const scores: Record<string, number> = {};
    myQuestions.forEach((q) => {
      if (!(q.id in localScores)) {
        scores[q.id] = Number(q.score) || 0;
      }
    });
    if (Object.keys(scores).length > 0) {
      setLocalScores((prev) => ({ ...scores, ...prev }));
    }
  }, [myQuestions, localScores]);

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!id || files.length === 0) return;
    setUploading(true);
    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast.error(`"${file.name}" không phải ảnh hoặc PDF`);
        continue;
      }
      const filePath = `${id}/${Date.now()}_${i}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("cv-images").upload(filePath, file);
      if (uploadError) { toast.error(`Lỗi upload "${file.name}": ${uploadError.message}`); continue; }
      const { data: urlData } = supabase.storage.from("cv-images").getPublicUrl(filePath);
      await supabase.from("cv_images").insert({ candidate_id: id, image_url: urlData.publicUrl, sort_order: cvImages.length + i });
      successCount++;
    }
    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ["cv-images", id] });
      toast.success(`Đã upload ${successCount} file`);
    }
    setUploading(false);
  }, [id, cvImages.length, queryClient]);

  const handleUploadCV = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) uploadFiles(Array.from(e.target.files));
    e.target.value = "";
  }, [uploadFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) uploadFiles(Array.from(e.dataTransfer.files));
  }, [uploadFiles]);

  const addQuestionsMutation = useMutation({
    mutationFn: async () => {
      if (!user || !role || !id || !isInterviewer) return;
      const lines = newQuestionsText.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) return;
      const inserts = lines.map((content) => ({
        candidate_id: id, interviewer_role: role as AppRole, user_id: user.id, content, score: 0,
      }));
      const { data, error } = await supabase.from("interview_questions").insert(inserts).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (newQuestions) => {
      queryClient.invalidateQueries({ queryKey: ["questions", id] });
      // Immediately add new questions to local scores with default score 0
      if (newQuestions) {
        const newScores: Record<string, number> = {};
        newQuestions.forEach((q: any) => {
          newScores[q.id] = 0;
        });
        setLocalScores((prev) => ({ ...prev, ...newScores }));
      }
      setNewQuestionsText("");
      toast.success("Đã thêm câu hỏi");
    },
    onError: (err: Error) => toast.error("Lỗi: " + err.message),
  });

  const saveScoreMutation = useMutation({
    mutationFn: async ({ questionId, score }: { questionId: string; score: number }) => {
      const { error } = await supabase.from("interview_questions").update({ score: Math.min(10, Math.max(0, score)) }).eq("id", questionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["questions", id] }),
    onError: (err: Error) => toast.error("Lỗi: " + err.message),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      const { error } = await supabase.from("interview_questions").delete().eq("id", questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions", id] });
      toast.success("Đã xóa câu hỏi");
    },
  });

  const handleDeleteImage = async (imageId: string, imageUrl: string) => {
    const pathMatch = imageUrl.match(/cv-images\/(.+)$/);
    if (pathMatch) await supabase.storage.from("cv-images").remove([pathMatch[1]]);
    await supabase.from("cv_images").delete().eq("id", imageId);
    queryClient.invalidateQueries({ queryKey: ["cv-images", id] });
    toast.success("Đã xóa");
  };

  const handleUpdateCandidate = async () => {
    if (!id || !editName.trim()) return;
    const { error } = await supabase.from("candidates").update({ name: editName.trim(), role: editRole.trim() || "Ứng viên" }).eq("id", id);
    if (error) toast.error("Lỗi: " + error.message);
    else {
      toast.success("Đã cập nhật");
      queryClient.invalidateQueries({ queryKey: ["candidate", id] });
    }
    setEditingCandidate(false);
  };

  const getAverage = (qs: typeof allQuestions) => {
    const scored = qs.filter((q) => Number(q.score) > 0);
    if (scored.length === 0) return 0;
    return scored.reduce((sum, q) => sum + Number(q.score), 0) / scored.length;
  };

  const interviewerRoles = ["interviewer_1", "interviewer_2", "interviewer_3"] as const;
  const overallScores = interviewerRoles.map((r) => getAverage(allQuestions.filter((q) => q.interviewer_role === r))).filter((a) => a > 0);
  const overallAverage = overallScores.length > 0 ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length : 0;

  const isPdf = (url: string) => url.toLowerCase().includes(".pdf");
  const scoreColor = (avg: number) => avg >= 8 ? "text-success" : avg >= 5 ? "text-primary" : "text-muted-foreground";

  if (!candidate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-blue-500/20 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-blue-500 border-r-blue-500 rounded-full animate-spin" style={{ animationDuration: '1.5s' }}></div>
        </div>
      </div>
    );
  }

  const QuestionBlock = ({ r, qs, editable = false }: { r: string; qs: typeof allQuestions; editable?: boolean }) => {
    const avg = getAverage(qs);
    if (qs.length === 0 && !editable) return null;
    return (
      <div className="rounded-2xl bg-card shadow-card border border-border/40 overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border/40 bg-muted/20">
          <div className={`w-2.5 h-2.5 rounded-full ${ROLE_DOT_COLORS[r] || "bg-foreground"}`} />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            {editable ? "Câu hỏi của bạn" : ROLE_LABELS[r] || r}
          </h3>
          {qs.length > 0 && (
            <span className="ml-auto text-[11px] text-muted-foreground font-medium">{qs.length} câu</span>
          )}
        </div>

        {qs.length > 0 && (
          <div className="divide-y divide-border/30">
            {qs.map((q, idx) => (
              <div key={q.id} className="flex items-center gap-3 px-5 py-3.5 group hover:bg-muted/10 transition-colors">
                <span className="text-[11px] text-muted-foreground/50 w-5 shrink-0 tabular-nums font-medium">{idx + 1}</span>
                <p className="text-sm text-foreground flex-1 leading-relaxed">{q.content}</p>
                {editable ? (
                  <>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={localScores[q.id] ?? 0}
                      onChange={(e) => {
                        const val = Math.min(10, Math.max(0, parseFloat(e.target.value) || 0));
                        setLocalScores((prev) => ({ ...prev, [q.id]: val }));
                        saveScoreMutation.mutate({ questionId: q.id, score: val });
                      }}
                      className="w-14 rounded-lg border border-input bg-background px-2 py-1.5 text-sm tabular-nums text-center text-foreground focus:outline-none focus:ring-2 focus:ring-ring/25 transition-all"
                      placeholder="0"
                    />
                    <button
                      onClick={() => deleteQuestionMutation.mutate(q.id)}
                      className="text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </>
                ) : (
                  <span className={`text-sm font-bold tabular-nums w-10 text-right ${Number(q.score) > 0 ? scoreColor(Number(q.score)) : "text-muted-foreground/30"}`}>
                    {Number(q.score) > 0 ? Number(q.score).toFixed(1) : "—"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {qs.length > 0 && (
          <div className="px-5 py-3 border-t border-border/40 bg-muted/15 flex justify-between items-center">
            <span className="text-xs font-semibold text-muted-foreground">Trung bình</span>
            <span className={`text-lg font-extrabold tabular-nums ${scoreColor(avg)}`}>
              {avg > 0 ? avg.toFixed(1) : "—"}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-float opacity-20"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-float opacity-20" style={{ animationDelay: "2s" }}></div>
      </div>

      {/* Header */}
      <header className="relative z-20 bg-gradient-to-b from-slate-800/95 to-slate-800/70 backdrop-blur-xl border-b border-slate-700/50 sticky top-0">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center gap-5">
          <Link to="/" className="text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 p-2 rounded-lg transition-all duration-200">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </Link>
          <div className="h-6 w-px bg-slate-700/50" />
          <div className="flex-1 min-w-0">
            {editingCandidate ? (
              <div className="flex items-center gap-3">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-lg font-black text-white bg-slate-700 rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  autoFocus
                />
                <input
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="text-xs text-slate-400 bg-slate-700 rounded-lg px-3 py-1.5 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  placeholder="Vị trí"
                />
                <button 
                  onClick={handleUpdateCandidate} 
                  className="text-xs font-black text-blue-400 hover:text-blue-300 transition-colors px-3 py-1.5 hover:bg-slate-700/50 rounded-lg"
                >
                  ✅ Lưu
                </button>
                <button 
                  onClick={() => setEditingCandidate(false)} 
                  className="text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 hover:bg-slate-700/50 rounded-lg"
                >
                  ❌ Hủy
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 group">
                <div>
                  <h1 className="text-2xl font-black text-white group-hover:text-blue-400 transition-colors">{candidate.name}</h1>
                  <p className="text-xs text-slate-400 mt-0.5">{candidate.role}</p>
                </div>
                {(isViewer || isInterviewer) && (
                  <button
                    onClick={() => { setEditName(candidate.name); setEditRole(candidate.role); setEditingCandidate(true); }}
                    className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 transition-all duration-200 opacity-0 group-hover:opacity-100"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-black tabular-nums">
              {overallAverage > 0 ? (
                <span className={overallAverage >= 8 ? "text-green-400" : overallAverage >= 5 ? "text-blue-400" : "text-slate-400"}>
                  {overallAverage.toFixed(1)}
                </span>
              ) : (
                <span className="text-slate-500">—</span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-black">Điểm TB</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: CV + Questions */}
          <div className="lg:col-span-3 space-y-6">
            {/* CV Viewer - A4 Frame */}
            <div
              className={`rounded-2xl border overflow-hidden transition-all duration-300 ${dragOver ? "border-blue-400 bg-blue-500/10 border-2" : "border-slate-700 bg-gradient-to-br from-slate-800 to-slate-700"}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-gradient-to-r from-slate-700/50 to-slate-800/50">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">📄 CV ứng viên</h3>
                {!showUploadForm ? (
                  <button 
                    onClick={() => setShowUploadForm(true)} 
                    className={`text-xs cursor-pointer transition-all font-bold flex items-center gap-2 px-4 py-2 rounded-lg ${
                      uploading 
                        ? "text-slate-500 pointer-events-none" 
                        : "text-blue-400 hover:text-blue-300 hover:bg-slate-700/50"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                    {uploading ? "Đang upload..." : "Upload"}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className={`text-xs cursor-pointer transition-all font-bold flex items-center gap-2 px-4 py-2 rounded-lg ${
                      uploading 
                        ? "text-slate-500 pointer-events-none" 
                        : "text-blue-400 hover:text-blue-300 hover:bg-slate-700/50"
                    }`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                      {uploading ? "Đang upload..." : "Chọn file"}
                      <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleUploadCV} disabled={uploading} />
                    </label>
                    <button 
                      onClick={() => setShowUploadForm(false)} 
                      className="text-xs text-slate-400 hover:text-white px-3 py-2 hover:bg-slate-700/50 rounded-lg transition-all"
                    >
                      ❌ Hủy
                    </button>
                  </div>
                )}
              </div>
              {showUploadForm && (
                <div
                  className={`border-b transition-all duration-300 ${dragOver ? "border-blue-400 border-2 bg-blue-500/20" : "border-slate-700 bg-slate-800/50"}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="px-6 py-10 text-center">
                    {dragOver ? (
                      <p className="text-sm text-blue-400 font-bold">🎯 Thả file vào đây</p>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-xl bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                          </svg>
                        </div>
                        <p className="text-sm font-bold text-white">Kéo thả hoặc bấm "Chọn file"</p>
                        <p className="text-xs text-slate-400 mt-2">Hỗ trợ ảnh & PDF</p>
                      </>
                    )}
                  </div>
                </div>
              )}
              {cvImages.length === 0 && !showUploadForm ? (
                <div className="px-5 py-14 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <p className="text-sm font-medium text-foreground">Chưa có CV</p>
                  <p className="text-xs text-muted-foreground mt-1">Bấm "Upload" để thêm CV</p>
                </div>
              ) : cvImages.length > 0 ? (
                <div className="p-5 space-y-5">
                  {cvImages.map((img) => (
                    <div key={img.id} className="relative group">
                      {/* A4 Frame Container */}
                      <div className="bg-background rounded-xl border border-border/50 shadow-sm overflow-hidden mx-auto" style={{ maxWidth: '595px' }}>
                        {isPdf(img.image_url) ? (
                          <div>
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border/30">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--destructive))" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              <span className="text-xs font-medium text-foreground truncate flex-1">{decodeURIComponent(img.image_url.split("/").pop() || "PDF")}</span>
                              <a href={img.image_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-medium">Mở tab mới</a>
                            </div>
                            <div className="a4-frame">
                              <iframe src={img.image_url} className="w-full h-full" title="CV" />
                            </div>
                          </div>
                        ) : (
                          <div className="a4-frame bg-card flex items-start justify-center overflow-hidden">
                            <img src={img.image_url} alt="CV" className="w-full h-full object-contain" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteImage(img.id, img.image_url)}
                        className="absolute top-3 right-3 bg-foreground/80 text-background text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm font-medium shadow-sm"
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                  {dragOver && (
                    <div className="flex items-center justify-center py-8 border-2 border-dashed border-primary rounded-xl bg-primary/5">
                      <p className="text-sm text-primary font-semibold">Thả file vào đây</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Add questions (interviewer) */}
            {isInterviewer && (
              <div className="rounded-2xl bg-card shadow-card border border-border/40 p-5">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">Thêm câu hỏi</h3>
                <p className="text-[11px] text-muted-foreground mb-3">Mỗi dòng = 1 câu hỏi</p>
                <textarea
                  value={newQuestionsText}
                  onChange={(e) => setNewQuestionsText(e.target.value)}
                  placeholder={"Nhập câu hỏi...\nMỗi dòng là một câu hỏi riêng"}
                  rows={3}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/25 resize-y transition-all"
                />
                <button
                  onClick={() => addQuestionsMutation.mutate()}
                  disabled={addQuestionsMutation.isPending || !newQuestionsText.trim()}
                  className="mt-3 gradient-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:opacity-90 transition-all text-sm font-semibold disabled:opacity-40 shadow-sm"
                >
                  {addQuestionsMutation.isPending ? "Đang thêm..." : "Thêm"}
                </button>
              </div>
            )}

            {/* My questions with scoring */}
            {isInterviewer && <QuestionBlock r={role!} qs={myQuestions} editable />}

            {/* Other interviewers' questions */}
            {isInterviewer && interviewerRoles
              .filter((r) => r !== role)
              .map((r) => <QuestionBlock key={r} r={r} qs={allQuestions.filter((q) => q.interviewer_role === r)} />)}

            {/* Viewer sees all */}
            {isViewer && interviewerRoles.map((r) => (
              <QuestionBlock key={r} r={r} qs={allQuestions.filter((q) => q.interviewer_role === r)} />
            ))}
          </div>

          {/* Sidebar: Score Summary */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-card shadow-card border border-border/40 p-6 sticky top-20">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-6">Tổng kết</h3>

              <div className="space-y-4">
                {interviewerRoles.map((r) => {
                  const qs = allQuestions.filter((q) => q.interviewer_role === r);
                  const avg = getAverage(qs);
                  return (
                    <div key={r} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${ROLE_DOT_COLORS[r]}`} />
                        <span className="text-xs font-medium text-muted-foreground">{ROLE_LABELS[r]}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground/50 font-medium">{qs.length} câu</span>
                        <span className={`text-sm font-bold tabular-nums min-w-[2rem] text-right ${avg > 0 ? scoreColor(avg) : "text-muted-foreground/30"}`}>
                          {avg > 0 ? avg.toFixed(1) : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-5 border-t border-dashed border-border">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-foreground">Trung bình chung</span>
                  <span className={`text-5xl font-extrabold tabular-nums tracking-tighter ${scoreColor(overallAverage)}`}>
                    {overallAverage > 0 ? overallAverage.toFixed(1) : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CandidateDetail;
