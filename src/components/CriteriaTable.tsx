interface Criterion {
  id: number;
  name: string;
  description: string;
  maxScore: number;
}

const EVALUATION_CRITERIA: Criterion[] = [
  {
    id: 1,
    name: "Giới thiệu bản thân",
    description: "Trình bày rõ ràng, tự tin, giới thiệu ngắn gọn về bản thân",
    maxScore: 10,
  },
  {
    id: 2,
    name: "Kiến thức chuyên môn",
    description: "Hiểu biết về lập trình (Java, C++, Python, JS…) và kiến thức CNTT cơ bản",
    maxScore: 10,
  },
  {
    id: 3,
    name: "Kỹ năng lập trình thực tế",
    description: "Có dự án cá nhân, biết HTML/CSS/JS, Git hoặc công cụ phát triển",
    maxScore: 10,
  },
  {
    id: 4,
    name: "Tư duy giải quyết vấn đề",
    description: "Khả năng phân tích vấn đề, trả lời câu hỏi logic",
    maxScore: 10,
  },
  {
    id: 5,
    name: "Khả năng học hỏi",
    description: "Thể hiện tinh thần học hỏi, tiếp thu công nghệ mới",
    maxScore: 10,
  },
  {
    id: 6,
    name: "Kỹ năng giao tiếp",
    description: "Trình bày rõ ràng, trả lời câu hỏi mạch lạc",
    maxScore: 10,
  },
  {
    id: 7,
    name: "Khả năng làm việc nhóm",
    description: "Thái độ hợp tác, biết chia sẻ và phối hợp với team",
    maxScore: 10,
  },
  {
    id: 8,
    name: "Thái độ & sự chuyên nghiệp",
    description: "Tác phong, thái độ khi phỏng vấn",
    maxScore: 10,
  },
  {
    id: 9,
    name: "Sự phù hợp với vị trí",
    description: "Mức độ phù hợp với công việc Intern/Part-time",
    maxScore: 10,
  },
  {
    id: 10,
    name: "Tổng thể",
    description: "Ấn tượng chung của nhà tuyển dụng",
    maxScore: 10,
  },
];

export const CriteriaTable = ({ title = "Tiêu chí Chấm điểm - SE Intern Position" }: { title?: string }) => {
  const totalMaxScore = EVALUATION_CRITERIA.reduce((sum, c) => sum + c.maxScore, 0);

  return (
    <div className="w-full max-w-6xl rounded-2xl bg-gradient-to-br from-white via-pink-50/30 to-white border border-pink-200/50 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 bg-gradient-to-r from-pink-400 to-rose-400">
        <h2 className="text-2xl font-black text-white mb-1">{title}</h2>
        <p className="text-pink-100 text-sm">Vị trí: Software Engineering Intern / Part-time Developer</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-pink-200/50 bg-pink-50/50">
              <th className="px-6 py-4 text-center text-xs font-bold text-pink-700 uppercase tracking-wider w-12">STT</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-pink-700 uppercase tracking-wider">Tiêu chí đánh giá</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-pink-700 uppercase tracking-wider">Mô tả</th>
              <th className="px-6 py-4 text-center text-xs font-bold text-pink-700 uppercase tracking-wider w-24">Điểm tối đa</th>
            </tr>
          </thead>
          <tbody>
            {EVALUATION_CRITERIA.map((criterion, idx) => (
              <tr
                key={criterion.id}
                className={`border-b border-pink-100/50 transition-colors hover:bg-pink-50/50 ${
                  idx % 2 === 0 ? "bg-white" : "bg-pink-50/20"
                }`}
              >
                <td className="px-6 py-4 text-center font-bold text-pink-700">{criterion.id}</td>
                <td className="px-6 py-4 font-semibold text-foreground">{criterion.name}</td>
                <td className="px-6 py-4">
                  <span className="text-sm text-muted-foreground">{criterion.description}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-pink-200 to-rose-200 text-pink-700 font-bold text-sm">
                    {criterion.maxScore}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gradient-to-r from-pink-200/40 to-rose-200/40 border-t-2 border-pink-300">
              <td colSpan={3} className="px-6 py-4 font-bold text-pink-700 text-right">
                Tổng điểm tối đa
              </td>
              <td className="px-6 py-4 text-center">
                <span className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-pink-400 to-rose-400 text-white font-bold text-sm">
                  {totalMaxScore}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer Info */}
      <div className="px-8 py-5 bg-pink-50/50 border-t border-pink-200/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase">Thời gian làm việc</p>
            <p className="text-sm font-bold text-foreground">20-25 giờ/tuần (linh hoạt)</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase">Hạn nộp hồ sơ</p>
            <p className="text-sm font-bold text-foreground">15/3 - 23:00</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase">Số lượng tuyển</p>
            <p className="text-sm font-bold text-foreground">03-05 ứng viên</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CriteriaTable;
