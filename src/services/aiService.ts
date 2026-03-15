// Groq API keys with rotation support
// Load from environment variables (defined in .env or .env.local)
const GROQ_API_KEYS = [
  import.meta.env.VITE_GROQ_API_KEY_1 || "",
  import.meta.env.VITE_GROQ_API_KEY_2 || "",
].filter(key => key !== "");

let currentKeyIndex = 0;

const isApiKeyConfigured = () => {
  return GROQ_API_KEYS.length > 0;
};

const getCurrentKey = () => {
  return GROQ_API_KEYS[currentKeyIndex];
};

const rotateKey = () => {
  currentKeyIndex = (currentKeyIndex + 1) % GROQ_API_KEYS.length;
  console.log(`Switched to API key index ${currentKeyIndex}`);
};

export interface GeneratedQuestions {
  hr1: string[]; // Personal info, education, career goals
  hr2: string[]; // Technical skills, professional knowledge
  hr3: string[]; // Soft skills, attitude, work situations
}

// Dynamic import of Tesseract.js for OCR
const getTesseract = async () => {
  const Tesseract = await import("tesseract.js");
  return Tesseract;
};

export const extractCVText = async (
  cvImages: Array<{ image_url: string }>
): Promise<string> => {
  if (cvImages.length === 0) {
    return "No CV uploaded";
  }

  try {
    const Tesseract = await getTesseract();
    let extractedText = "CV Content:\n";

    for (const img of cvImages) {
      try {
        if (img.image_url.toLowerCase().includes(".pdf")) {
          extractedText += "[PDF file uploaded - OCR not supported for PDFs]\n";
          continue;
        }

        console.log(`Extracting text from image: ${img.image_url}`);
        const worker = await Tesseract.createWorker("vie"); // Vietnamese language
        const result = await worker.recognize(img.image_url);
        const text = result.data.text || "";

        if (text.trim()) {
          extractedText += `\n${text}\n`;
        }

        await worker.terminate();
      } catch (imgError) {
        console.warn(`Failed to extract text from image: ${img.image_url}`, imgError);
        extractedText += `[Could not extract text from one image]\n`;
      }
    }

    return extractedText.trim() || "CV images uploaded but text could not be extracted";
  } catch (error) {
    console.warn("Tesseract.js OCR not available, proceeding with generic CV reference", error);
    return `${cvImages.length} CV page(s) uploaded`;
  }
};

export const generateInterviewQuestions = async (
  candidateName: string,
  candidateRole: string,
  cvContent: string
): Promise<GeneratedQuestions> => {
  // Validate API keys are configured
  if (!isApiKeyConfigured()) {
    throw new Error(
      "Groq API keys not configured. Please add VITE_GROQ_API_KEY_1 and VITE_GROQ_API_KEY_2 to your .env file"
    );
  }

  const prompt = `You are an expert recruiter conducting interviews for the position of "${candidateRole}".

CANDIDATE INFORMATION:
Name: ${candidateName}
CV/Background:
${cvContent}

Your task: Generate exactly 5 highly specific interview questions for each of the following 3 HR interviewers. Each interviewer will conduct a focused assessment.

IMPORTANT RULES:
1. ALL QUESTIONS MUST BE SPECIFIC TO THE CANDIDATE'S CV, SKILLS, AND EXPERIENCE
2. Reference specific technologies, projects, companies, and achievements mentioned in the CV
3. Ask follow-up style questions that probe deeper into what they wrote
4. Use Vietnamese (Tiếng Việt) for all questions
5. **USE "BẠN" IN ALL QUESTIONS - Address the candidate as "bạn" in every question**

---
HR INTERVIEWER 1 - PERSONAL & CAREER DEVELOPMENT (5 questions):
Focus: Personal background, educational qualifications, career progression, and future goals
- Ask about their education/degrees/certifications mentioned in CV (use "bạn")
- Ask about career transitions between roles listed in CV (use "bạn")
- Ask about long-term career aspirations and how this role fits (use "bạn")
- Probe their motivation for career choices (use "bạn")
- Ask about personal strengths and how they relate to the position (use "bạn")

HR INTERVIEWER 2 - TECHNICAL & PROFESSIONAL KNOWLEDGE (5 questions):
Focus: SPECIFIC technical skills, tools, frameworks, and professional knowledge from their CV
- Identify specific programming languages/tools mentioned in CV and ask detailed questions about them (use "bạn")
- Ask deep technical questions about projects they claim to have worked on (use "bạn")
- Ask about specific methodologies, architectures, or technical approaches they've used (use "bạn")
- Probe their expertise in the specific technologies required for this role (use "bạn")
- Question their hands-on experience with frameworks, databases, or tools they list (use "bạn")

HR INTERVIEWER 3 - SOFT SKILLS, ATTITUDE & WORK SITUATIONS (5 questions):
Focus: Teamwork, communication, problem-solving, conflict resolution, and work mindset
- Ask about specific work challenges they've faced and how they handled them (use "bạn")
- Ask about collaboration and communication in past team projects (use "bạn")
- Ask about conflicts and how they resolved them (use "bạn")
- Ask about their approach to learning and professional development (use "bạn")
- Ask about their work style and how they contribute to team success (use "bạn")

---
FORMAT YOUR RESPONSE EXACTLY LIKE THIS (no other text):
HR1_QUESTION_1: [question in Vietnamese using "bạn"]
HR1_QUESTION_2: [question in Vietnamese using "bạn"]
HR1_QUESTION_3: [question in Vietnamese using "bạn"]
HR1_QUESTION_4: [question in Vietnamese using "bạn"]
HR1_QUESTION_5: [question in Vietnamese using "bạn"]
HR2_QUESTION_1: [question in Vietnamese using "bạn" about specific technical skills from CV]
HR2_QUESTION_2: [question in Vietnamese using "bạn" about specific project/technology from CV]
HR2_QUESTION_3: [question in Vietnamese using "bạn" about specific tool/framework from CV]
HR2_QUESTION_4: [question in Vietnamese using "bạn" about specific technical expertise from CV]
HR2_QUESTION_5: [question in Vietnamese using "bạn" about specific skill/knowledge from CV]
HR3_QUESTION_1: [question in Vietnamese using "bạn"]
HR3_QUESTION_2: [question in Vietnamese using "bạn"]
HR3_QUESTION_3: [question in Vietnamese using "bạn"]
HR3_QUESTION_4: [question in Vietnamese using "bạn"]
HR3_QUESTION_5: [question in Vietnamese using "bạn"]`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < GROQ_API_KEYS.length; attempt++) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${getCurrentKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const responseText = data.choices[0]?.message?.content || "";

      // Parse the response
      const questions: GeneratedQuestions = {
        hr1: [],
        hr2: [],
        hr3: [],
      };

      const lines = responseText.split("\n").filter((line) => line.trim());
      for (const line of lines) {
        const match = line.match(/^(HR\d)_QUESTION_(\d):\s*(.+)$/i);
        if (match) {
          const [, hrRole, , questionText] = match;
          const role = hrRole.toLowerCase();
          if (role in questions) {
            questions[role as keyof GeneratedQuestions].push(questionText.trim());
          }
        }
      }

      // Verify we have all questions
      if (
        questions.hr1.length === 5 &&
        questions.hr2.length === 5 &&
        questions.hr3.length === 5
      ) {
        return questions;
      }

      throw new Error("Failed to parse all questions from response");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `API key ${currentKeyIndex} failed: ${lastError.message}. Trying next key...`
      );
      rotateKey();
    }
  }

  const errorMessage = lastError?.message || "Unknown error";
  throw new Error(`Failed to generate questions after trying all API keys. Last error: ${errorMessage}`);
};
