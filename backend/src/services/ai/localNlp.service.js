const fs = require('fs');
const path = require('path');
const { NlpManager } = require('node-nlp');

let manager = null;
let isModelReady = false;

const MODEL_PATH = path.join(__dirname, 'model.nlp');
const DATASET_PATH = path.join(__dirname, '../../../../ai_training/dataset_intent.json');

/**
 * Khởi tạo và nạp mô hình AI tự huấn luyện (Self-Trained Local NLP Model)
 */
const initLocalNlpModel = async () => {
  if (isModelReady && manager) return manager;

  try {
    manager = new NlpManager({ languages: ['vi', 'en'], forceNER: true, nlu: { log: false } });

    if (fs.existsSync(MODEL_PATH)) {
      console.log('[SelfTrainedAI] Đang nạp trọng số mô hình đã huấn luyện từ model.nlp...');
      manager.load(MODEL_PATH);
      isModelReady = true;
      console.log('✅ [SelfTrainedAI] Đã nạp thành công mô hình NLP tự huấn luyện cục bộ!');
    } else if (fs.existsSync(DATASET_PATH)) {
      console.log('[SelfTrainedAI] Chưa có file model.nlp, tự động huấn luyện trên dataset_intent.json...');
      const rawData = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
      rawData.forEach(item => {
        manager.addDocument('vi', item.text, item.intent);
      });
      await manager.train();
      manager.save(MODEL_PATH);
      isModelReady = true;
      console.log('✅ [SelfTrainedAI] Huấn luyện hoàn tất và đã lưu model.nlp!');
    }
  } catch (err) {
    console.warn('[SelfTrainedAI] Không thể khởi tạo mô hình cục bộ:', err.message);
  }

  return manager;
};

// Tự động nạp khi module được require
initLocalNlpModel().catch(() => {});

/**
 * Phân loại ý định bằng Mô hình AI tự huấn luyện (Self-Trained Model Inference)
 * @param {string} promptText 
 * @returns {Promise<{intent: string, confidence: number, entities: any}|null>}
 */
const classifyIntentLocal = async (promptText) => {
  if (!promptText || !promptText.trim()) return null;

  try {
    if (!isModelReady || !manager) {
      await initLocalNlpModel();
    }
    if (!manager) return null;

    const result = await manager.process('vi', promptText.trim());
    if (result && result.intent && result.intent !== 'None') {
      return {
        intent: result.intent,
        confidence: Number(result.score || 0),
        entities: result.entities || []
      };
    }
  } catch (err) {
    console.warn('[SelfTrainedAI] Inference error:', err.message);
  }

  return null;
};

module.exports = {
  initLocalNlpModel,
  classifyIntentLocal
};
