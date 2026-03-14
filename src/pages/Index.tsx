// Update this page (the content is just a fallback if you fail to update the page)
import { CriteriaTable } from "@/components/CriteriaTable";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-pink-100">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-pink-200/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-rose-200/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30" style={{ animationDelay: "2s" }}></div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12 max-w-2xl animate-fade-in">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-rose-400 rounded-2xl blur-lg opacity-50 animate-pulse"></div>
              <div className="relative w-16 h-16 bg-gradient-to-br from-pink-300 to-rose-400 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-2xl">
                ✿
              </div>
            </div>
          </div>
          <h1 className="text-5xl font-black text-rose-700 mb-3 tracking-tight">InterviewOS</h1>
          <p className="text-lg text-rose-600/80">Hệ thống đánh giá phỏng vấn chuyên nghiệp</p>
          <p className="text-sm text-rose-600/60 mt-3">Tuyển dụng Software Engineering Intern / Part-time Developer</p>
        </div>

        {/* Criteria Table */}
        <div className="w-full flex justify-center mb-12">
          <CriteriaTable />
        </div>

        {/* Info Box */}
        <div className="max-w-2xl mx-auto bg-white/80 backdrop-blur-sm border border-pink-200 rounded-2xl p-8 shadow-lg">
          <h2 className="text-xl font-bold text-pink-700 mb-4">📌 Quy trình phỏng vấn</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">👤</span>
              <div>
                <p className="font-bold text-foreground">HR 1 - Phỏng vấn Nhân sự</p>
                <p className="text-sm text-muted-foreground">Thông tin cá nhân, học vấn, định hướng sự nghiệp</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">💻</span>
              <div>
                <p className="font-bold text-foreground">HR 2 - Phỏng vấn Kỹ thuật</p>
                <p className="text-sm text-muted-foreground">Kiến thức lập trình, kỹ năng chuyên môn</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <p className="font-bold text-foreground">HR 3 - Phỏng vấn Năng lực Mềm</p>
                <p className="text-sm text-muted-foreground">Kỹ năng làm việc nhóm, thái độ, tình huống</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
