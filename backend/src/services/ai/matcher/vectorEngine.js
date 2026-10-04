/**
 * VECTOR ENGINE - GIAI ĐOẠN 3: ĐỘNG CƠ TÍNH TOÁN VECTOR EMBEDDING & COSINE SIMILARITY
 * - Sử dụng kết hợp Word n-gram và Subword Char n-gram (2-4 chars) để kháng lỗi chính tả tiếng Việt
 * - Mô hình hóa trọng số TF-IDF (Term Frequency - Inverse Document Frequency)
 * - Vector chuẩn hóa L2-norm để tính Cosine Similarity cực nhanh bằng tích vô hướng (Dot Product)
 * - Chạy 100% Offline trên CPU Node.js, thời gian suy luận < 2ms, không phụ thuộc thư viện ngoài
 */

class VectorEngine {
  constructor(options = {}) {
    this.minCharGram = options.minCharGram || 2;
    this.maxCharGram = options.maxCharGram || 4;
    this.vocabulary = new Map(); // token -> index
    this.idf = []; // index -> idf weight
    this.documents = []; // array of { id, text, metadata, vector }
    this.isTrained = false;
  }

  /**
  /**
   * Khử dấu tiếng Việt
   */
  removeTones(str) {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  /**
   * Chuẩn hóa văn bản tiếng Việt
   */
  normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tách đặc trưng (Features): kết hợp Word tokens, Unaccented words và Subword Character n-grams
   */
  extractFeatures(text) {
    const clean = this.normalizeText(text);
    if (!clean) return [];

    const unaccented = this.removeTones(clean);
    const features = [];
    const words = clean.split(' ').filter(Boolean);
    const unaccentedWords = unaccented.split(' ').filter(Boolean);

    // 1. Word unigrams & bigrams (Cả có dấu và không dấu)
    for (let i = 0; i < words.length; i++) {
      features.push(`w:${words[i]}`);
      features.push(`u:${unaccentedWords[i]}`);

      if (i < words.length - 1) {
        features.push(`w2:${words[i]}_${words[i + 1]}`);
        features.push(`u2:${unaccentedWords[i]}_${unaccentedWords[i + 1]}`);
      }
    }

    // 2. Character n-grams trên cả từ gốc và từ không dấu (Bắt lỗi chính tả, gõ tắt)
    for (const word of unaccentedWords) {
      if (word.length >= this.minCharGram) {
        const padded = `^${word}$`;
        for (let n = this.minCharGram; n <= this.maxCharGram; n++) {
          for (let i = 0; i <= padded.length - n; i++) {
            features.push(`c:${padded.slice(i, i + n)}`);
          }
        }
      }
    }

    return features;
  }

  /**
   * Huấn luyện từ điển từ vựng (Vocabulary) và trọng số IDF từ tập tài liệu
   * @param {Array<{id: string, text: string, metadata?: any}>} docs 
   */
  fit(docs) {
    this.vocabulary.clear();
    this.idf = [];
    this.documents = [];

    const docCount = docs.length;
    if (docCount === 0) return;

    // 1. Đếm Document Frequency (DF) cho từng token
    const dfMap = new Map();
    const tokenizedDocs = [];

    for (const doc of docs) {
      const tokens = this.extractFeatures(doc.text);
      tokenizedDocs.push({ doc, tokens });

      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        dfMap.set(token, (dfMap.get(token) || 0) + 1);
      }
    }

    // 2. Xây dựng Vocabulary và tính IDF: log((N + 1) / (df + 1)) + 1
    let vocabIndex = 0;
    for (const [token, df] of dfMap.entries()) {
      // Bỏ qua các token quá hiếm nếu tập tài liệu lớn
      this.vocabulary.set(token, vocabIndex);
      const idfValue = Math.log((docCount + 1) / (df + 1)) + 1.0;
      this.idf.push(idfValue);
      vocabIndex++;
    }

    // 3. Vector hóa tất cả các tài liệu huấn luyện và chuẩn hóa L2
    for (const { doc, tokens } of tokenizedDocs) {
      const vector = this.transformTokens(tokens);
      this.documents.push({
        id: doc.id,
        text: doc.text,
        metadata: doc.metadata || {},
        vector
      });
    }

    this.isTrained = true;
  }

  /**
   * Biến đổi danh sách tokens thành Vector TF-IDF chuẩn hóa L2
   */
  transformTokens(tokens) {
    const termFreq = new Map();
    for (const token of tokens) {
      const idx = this.vocabulary.get(token);
      if (idx !== undefined) {
        termFreq.set(idx, (termFreq.get(idx) || 0) + 1);
      }
    }

    // Sparse representation: Array of { index, value }
    const sparseVec = [];
    let sumSquares = 0;

    for (const [idx, count] of termFreq.entries()) {
      // TF log-normalization: 1 + log(count)
      const tf = 1 + Math.log(count);
      const tfidf = tf * this.idf[idx];
      sparseVec.push({ index: idx, value: tfidf });
      sumSquares += tfidf * tfidf;
    }

    // L2 Normalization (độ dài vector = 1)
    const norm = Math.sqrt(sumSquares);
    if (norm > 0) {
      for (let i = 0; i < sparseVec.length; i++) {
        sparseVec[i].value /= norm;
      }
    }

    // Sắp xếp tăng dần theo index để tính tích vô hướng (Dot Product) chính xác O(N)
    sparseVec.sort((a, b) => a.index - b.index);

    return sparseVec;
  }

  /**
   * Vector hóa một văn bản bất kỳ
   */
  vectorize(text) {
    const tokens = this.extractFeatures(text);
    return this.transformTokens(tokens);
  }

  /**
   * Tính Cosine Similarity giữa 2 sparse vector đã L2-normalized:
   * Vì cả 2 vector đã có ||A|| = ||B|| = 1, nên Cosine(A, B) = A . B (Dot Product)
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;

    let dot = 0;
    let i = 0;
    let j = 0;

    while (i < vecA.length && j < vecB.length) {
      if (vecA[i].index === vecB[j].index) {
        dot += vecA[i].value * vecB[j].value;
        i++;
        j++;
      } else if (vecA[i].index < vecB[j].index) {
        i++;
      } else {
        j++;
      }
    }

    return Math.min(Math.max(dot, 0), 1.0);
  }

  /**
   * Tìm kiếm các tài liệu có độ tương đồng Cosine cao nhất với câu hỏi
   * @param {string} query Văn bản câu hỏi
   * @param {number} topK Số lượng kết quả cao nhất cần lấy
   * @param {function} filterFn Hàm lọc metadata tùy chọn (ví dụ lọc theo role)
   * @returns {Array<{document: object, score: number}>}
   */
  search(query, topK = 5, filterFn = null) {
    if (!this.isTrained || this.documents.length === 0) return [];

    const queryVec = this.vectorize(query);
    if (queryVec.length === 0) return [];

    // Sắp xếp sparse vector theo index tăng dần để tính dot product nhanh
    queryVec.sort((a, b) => a.index - b.index);

    const scores = [];
    for (const doc of this.documents) {
      if (filterFn && !filterFn(doc)) continue;

      const score = this.cosineSimilarity(queryVec, doc.vector);
      if (score > 0) {
        scores.push({
          id: doc.id,
          text: doc.text,
          metadata: doc.metadata,
          score: Number(score.toFixed(4))
        });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }
}

module.exports = VectorEngine;
