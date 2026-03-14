import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const EVALUATION_CRITERIA = [
  { id: 1, name: "Giới thiệu bản thân" },
  { id: 2, name: "Kiến thức chuyên môn" },
  { id: 3, name: "Kỹ năng lập trình thực tế" },
  { id: 4, name: "Tư duy giải quyết vấn đề" },
  { id: 5, name: "Khả năng học hỏi" },
  { id: 6, name: "Kỹ năng giao tiếp" },
  { id: 7, name: "Khả năng làm việc nhóm" },
  { id: 8, name: "Thái độ & sự chuyên nghiệp" },
  { id: 9, name: "Sự phù hợp với vị trí" },
  { id: 10, name: "Tổng thể" },
];

const ROLE_LABELS: Record<string, string> = {
  interviewer_1: "HR 1",
  interviewer_2: "HR 2",
  interviewer_3: "HR 3",
};

export const EvaluationScoringPanel = ({
  candidateId,
  candidateName,
  role,
  isInterviewer,
}: {
  candidateId: string;
  candidateName: string;
  role?: string;
  isInterviewer: boolean;
}) => {
  const queryClient = useQueryClient();
  const [localScores, setLocalScores] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  // Fetch existing scores
  const { data: existingScore } = useQuery({
    queryKey: ["evaluation-score", candidateId, role],
    queryFn: async () => {
      const { data } = await supabase
        .from("interview_scores")
        .select("*")
        .eq("candidate_id", candidateId)
        .eq("interviewer_role", role as AppRole)
        .single();
      return data;
    },
    enabled: !!candidateId && !!role,
  });

  // Fetch all scores for this candidate
  const { data: allScores = [] } = useQuery({
    queryKey: ["all-scores", candidateId],
    queryFn: async () => {
      const { data } = await supabase
        .from("interview_scores")
        .select("*")
        .eq("candidate_id", candidateId);
      return data || [];
    },
    enabled: !!candidateId,
  });

  // Fetch all questions for this candidate
  const { data: allQuestions = [] } = useQuery({
    queryKey: ["all-questions", candidateId],
    queryFn: async () => {
      const { data } = await supabase
        .from("interview_questions")
        .select("*")
        .eq("candidate_id", candidateId);
      return data || [];
    },
    enabled: !!candidateId,
  });

  // Initialize local scores from database
  useEffect(() => {
    if (existingScore?.score) {
      // If there's a saved average score, initialize with it distributed equally
      const savedAverage = existingScore.score as number;
      const scores: Record<number, number> = {};
      EVALUATION_CRITERIA.forEach((c) => {
        scores[c.id] = savedAverage;
      });
      setLocalScores(scores);
    } else {
      // Initialize all with 0
      const scores: Record<number, number> = {};
      EVALUATION_CRITERIA.forEach((c) => {
        scores[c.id] = 0;
      });
      setLocalScores(scores);
    }
  }, [existingScore]);

  const saveScoreMutation = useMutation({
    mutationFn: async (criterionId: number) => {
      if (!candidateId || !role) return;

      const totalScore = Object.values(localScores).reduce((a, b) => a + b, 0);
      const averageScore = Object.keys(localScores).length > 0 
        ? totalScore / Object.keys(localScores).length
        : 0;

      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error("Không thể xác định người dùng");

      const scoreValue = Math.round(averageScore * 10) / 10;

      // First, try to find existing record
      const { data: existingScore, error: selectError } = await supabase
        .from("interview_scores")
        .select("id")
        .eq("candidate_id", candidateId)
        .eq("interviewer_role", role as AppRole)
        .maybeSingle();

      if (selectError) throw selectError;

      if (existingScore?.id) {
        // Update existing record
        const { error: updateError } = await supabase
          .from("interview_scores")
          .update({
            score: scoreValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingScore.id);
        
        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from("interview_scores")
          .insert({
            candidate_id: candidateId,
            interviewer_role: role as AppRole,
            score: scoreValue,
            user_id: userId,
          });
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["evaluation-score", candidateId, role],
      });
      queryClient.invalidateQueries({
        queryKey: ["all-scores", candidateId],
      });
      queryClient.invalidateQueries({
        queryKey: ["all-questions", candidateId],
      });
      setShowResults(true);
      toast.success("✅ Đã lưu điểm đánh giá");
    },
    onError: (err: Error) => toast.error("Lỗi: " + err.message),
  });

  const handleScoreChange = (criterionId: number, score: number) => {
    const validScore = Math.min(10, Math.max(0, score));
    setLocalScores((prev) => ({ ...prev, [criterionId]: validScore }));
  };

  const handleSaveAll = () => {
    saveScoreMutation.mutate(0);
  };

  // Calculate question counts per role
  const getQuestionCount = (role: string) => {
    return allQuestions.filter((q) => q.interviewer_role === role).length;
  };

  // Calculate average score for a role
  const getRoleScore = (role: string) => {
    const score = allScores.find((s) => s.interviewer_role === role);
    return score ? Number(score.score).toFixed(1) : "—";
  };

  // Calculate overall average
  const getOverallAverage = () => {
    const validScores = allScores.filter((s) => Number(s.score) > 0);
    if (validScores.length === 0) return "—";
    const avg = validScores.reduce((sum, s) => sum + Number(s.score), 0) / validScores.length;
    return avg.toFixed(1);
  };

  const totalScore = Object.values(localScores).reduce((a, b) => a + b, 0);
  const averageScore = Object.keys(localScores).length > 0 
    ? (totalScore / Object.keys(localScores).length).toFixed(1)
    : "0";

  if (!isInterviewer) return null;

  return (
    <div className="rounded-2xl bg-card shadow-card border border-border/40 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-foreground">🎯 Bảng Đánh giá - {candidateName}</h3>
          <p className="text-xs text-muted-foreground mt-1">Chấm điểm theo 10 tiêu chí, mỗi tiêu chí 10 điểm</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black tabular-nums text-rose-500">{averageScore}/10</div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Điểm TB</p>
        </div>
      </div>

      {/* Scoring Grid */}
      <div className="space-y-3 mb-6">
        {EVALUATION_CRITERIA.map((criterion, idx) => {
          const score = localScores[criterion.id] || 0;
          return (
            <div key={criterion.id} className="flex items-center gap-4 p-4 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-muted-foreground w-6">{criterion.id}.</span>
                  <p className="text-sm font-semibold text-foreground">{criterion.name}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={score}
                  onChange={(e) => handleScoreChange(criterion.id, parseFloat(e.target.value) || 0)}
                  className="w-16 rounded-lg border border-input bg-background px-3 py-2 text-center text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring/25 transition-all"
                  placeholder="0"
                />
                <span className="text-xs text-muted-foreground font-medium w-6 text-right">/10</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Score Summary */}
      <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-4 mb-6 border border-pink-200/50">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase">Tổng điểm</p>
            <p className="text-2xl font-black text-rose-600">{totalScore}/100</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase">Điểm trung bình</p>
            <p className="text-2xl font-black text-rose-600">{averageScore}/10</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSaveAll}
        disabled={saveScoreMutation.isPending}
        className="w-full px-5 py-3 rounded-lg bg-gradient-to-r from-pink-400 to-rose-400 text-white font-bold text-sm hover:from-pink-500 hover:to-rose-500 transition-all disabled:opacity-50 shadow-sm"
      >
        {saveScoreMutation.isPending ? "Đang lưu..." : "💾 Lưu Bảng Đánh giá"}
      </button>

      {/* Results Summary */}
      {showResults && (
        <div className="mt-6 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200/50 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-green-900 flex items-center gap-2 mb-1">
              ✅ Tổng kết đánh giá
            </h3>
            <p className="text-xs text-green-700">Kết quả đánh giá của tất cả các nhân viên HR</p>
          </div>

          {/* Results Grid */}
          <div className="space-y-3 mb-6">
            {["interviewer_1", "interviewer_2", "interviewer_3"].map((roleKey) => {
              const score = getRoleScore(roleKey);
              const count = getQuestionCount(roleKey);
              const displayScore = score === "—" ? "—" : `${score}/10`;
              
              return (
                <div
                  key={roleKey}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/60 border border-green-100/50 hover:bg-white/80 transition-colors"
                >
                  <div>
                    <p className="text-sm font-bold text-foreground">{ROLE_LABELS[roleKey]}</p>
                    <p className="text-xs text-muted-foreground">{count} câu hỏi</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black tabular-nums text-green-600">{displayScore}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall Average */}
          <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl p-4 border border-green-200/70">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-green-900 uppercase tracking-wider">Trung bình chung</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black tabular-nums text-green-700">{getOverallAverage()}/10</p>
              </div>
            </div>
          </div>

          {/* Close Results Button */}
          <button
            onClick={() => setShowResults(false)}
            className="w-full mt-4 px-4 py-2 rounded-lg bg-white/50 hover:bg-white text-green-700 font-semibold text-sm border border-green-200/50 transition-colors"
          >
            Đóng kết quả
          </button>
        </div>
      )}
    </div>
  );
};

export default EvaluationScoringPanel;
