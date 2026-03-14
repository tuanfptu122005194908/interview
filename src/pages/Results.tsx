import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const ROLE_LABELS: Record<string, string> = {
  interviewer_1: "HR 1",
  interviewer_2: "HR 2",
  interviewer_3: "HR 3",
};

const Results = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data } = await supabase.from("candidates").select("*").order("created_at");
      return data || [];
    },
  });

  const { data: allScores = [] } = useQuery({
    queryKey: ["all-scores-results"],
    queryFn: async () => {
      const { data } = await supabase.from("interview_scores").select("*");
      return data || [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("results-scores")
      .on("postgres_changes", { event: "*", schema: "public", table: "interview_scores" }, () => {
        queryClient.invalidateQueries({ queryKey: ["all-scores-results"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  if (role !== "viewer") return <Navigate to="/" replace />;

  const getScoreForRole = (candidateId: string, r: string) => {
    const score = allScores.find((s) => s.candidate_id === candidateId && s.interviewer_role === r);
    return score ? Number(score.score) : 0;
  };

  const getAverage = (candidateId: string) => {
    const scores = ["interviewer_1", "interviewer_2", "interviewer_3"]
      .map((r) => getScoreForRole(candidateId, r))
      .filter((s) => s > 0);
    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  const sorted = [...candidates].sort((a, b) => getAverage(b.id) - getAverage(a.id));
  const scoreColor = (v: number) => v >= 8 ? "text-success" : v >= 5 ? "text-primary" : "text-muted-foreground";

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border/60 sticky top-0 z-30 backdrop-blur-sm bg-card/95">
        <div className="mx-auto max-w-6xl px-6 py-3.5 flex items-center gap-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            Quay lại
          </Link>
          <div className="h-5 w-px bg-border" />
          <div>
            <h1 className="text-base font-bold text-foreground">Kết quả tổng hợp</h1>
            <p className="text-[11px] text-muted-foreground font-medium">Realtime • Sắp xếp theo điểm</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="rounded-2xl bg-card shadow-card border border-border/40 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3.5">#</th>
                <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3.5">Ứng viên</th>
                <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3.5">Vị trí</th>
                {Object.values(ROLE_LABELS).map((label) => (
                  <th key={label} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3.5">{label}</th>
                ))}
                <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3.5">TB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {sorted.map((c, i) => {
                const avg = getAverage(c.id);
                return (
                  <tr key={c.id} className="hover:bg-muted/15 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-muted-foreground tabular-nums font-medium">{i + 1}</td>
                    <td className="px-5 py-3.5">
                      <Link to={`/candidate/${c.id}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">{c.role}</td>
                    {["interviewer_1", "interviewer_2", "interviewer_3"].map((r) => {
                      const v = getScoreForRole(c.id, r);
                      return (
                        <td key={r} className={`px-5 py-3.5 text-sm text-center tabular-nums font-bold ${v > 0 ? scoreColor(v) : "text-muted-foreground/25"}`}>
                          {v > 0 ? v.toFixed(1) : "—"}
                        </td>
                      );
                    })}
                    <td className={`px-5 py-3.5 text-center text-sm font-extrabold tabular-nums ${avg > 0 ? scoreColor(avg) : "text-muted-foreground/25"}`}>
                      {avg > 0 ? avg.toFixed(1) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {candidates.length === 0 && (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-medium text-foreground">Chưa có ứng viên nào.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Results;
