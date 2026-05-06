import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface ParsedScheduleItem {
  day: number;
  time: string;
  title: string;
  description: string;
  locationName: string;
  category: 'visit' | 'food' | 'shopping' | 'transport' | 'hotel' | 'other';
}

export const readExcelFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      let text = '';
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        text += `Sheet: ${sheetName}\n`;
        text += XLSX.utils.sheet_to_txt(worksheet);
        text += '\n\n';
      });
      resolve(text);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const readWordFile = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

export const extractScheduleWithAI = async (
  input: string | { data: string, mimeType: string }, 
  tripInfo: { startDate: string, endDate: string }
): Promise<ParsedScheduleItem[]> => {
  const prompt = `
당신은 베테랑 여행 플래너입니다. 제공된 ${typeof input === 'string' ? '텍스트' : '파일'}에서 여행 일정을 추출하세요.
여행 기간: ${tripInfo.startDate} ~ ${tripInfo.endDate}

**반드시 준수할 규칙:**
1. 모든 출력(title, description, locationName)은 **한국어**로 작성하세요. 원문이 영어라도 자연스러운 한국어로 번역하세요.
2. 각 활동의 장소(locationName)를 최대한 구체적이고 정확인 명칭으로 추출하세요 (예: "도쿄 타워", "유니버설 스튜디오 재팬"). 장소 정보가 모호하면 주변 도시 이름을 포함하세요.
3. 일정의 날짜(day)를 여행 시작일로부터의 일차(1, 2, 3...)로 정확히 계산하세요.
4. 시간(time)은 HH:mm 형식으로 추출하되, 알 수 없는 경우 적절한 기본값(예: 09:00)을 사용하세요.

반환 형식은 다음 필드를 가진 JSON 배열입니다:
- day: 숫자 (1부터 시작)
- time: 문자열 (HH:mm 형식)
- title: 문자열 (활동 명칭, 한국어로)
- description: 문자열 (설명이나 메모, 한국어로)
- locationName: 문자열 (구체적인 장소명 또는 주소, 한국어로)
- category: ["visit", "food", "shopping", "transport", "hotel", "other"] 중 하나
`;

  try {
    const contents = [];
    if (typeof input === 'string') {
      contents.push({ text: prompt + `\n\nText to parse:\n"""\n${input}\n"""` });
    } else {
      contents.push({ text: prompt });
      contents.push({
        inlineData: {
          data: input.data,
          mimeType: input.mimeType
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.INTEGER, description: "Day number of the trip (1, 2, 3...)" },
              time: { type: Type.STRING, description: "Time in HH:mm format" },
              title: { type: Type.STRING, description: "Short title of the activity" },
              description: { type: Type.STRING, description: "Additional notes or description" },
              locationName: { type: Type.STRING, description: "Place name or address" },
              category: { 
                type: Type.STRING, 
                enum: ["visit", "food", "shopping", "transport", "hotel", "other"],
                description: "Category of the activity" 
              }
            },
            required: ["day", "time", "title", "category"]
          }
        }
      }
    });

    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error('AI Extraction failed:', error);
    throw new Error('일정 추출에 실패했습니다.');
  }
};
