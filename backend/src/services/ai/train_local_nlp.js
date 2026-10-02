const fs = require('fs');
const path = require('path');
const { NlpManager } = require('node-nlp');

async function trainLocalNlp() {
  console.log('🚀 Bắt đầu quá trình Huấn Luyện AI Model cục bộ (Local NLP Training)...');
  
  const datasetPath = path.join(__dirname, '../../../../ai_training/dataset_intent.json');
  if (!fs.existsSync(datasetPath)) {
    console.error('❌ Không tìm thấy dataset tại:', datasetPath);
    return;
  }

  const rawData = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  console.log(`📊 Tổng số mẫu dữ liệu trong dataset: ${rawData.length}`);

  // Khởi tạo NlpManager cho tiếng Việt và tiếng Anh (hỗ trợ đa ngữ)
  const manager = new NlpManager({
    languages: ['vi', 'en'],
    forceNER: true,
    nlu: { log: false }
  });

  // Chia dữ liệu Train (80%) và Test (20%)
  const shuffled = [...rawData].sort(() => 0.5 - Math.random());
  const splitIndex = Math.floor(shuffled.length * 0.8);
  const trainData = shuffled.slice(0, splitIndex);
  const testData = shuffled.slice(splitIndex);

  console.log(`📦 Tập Train: ${trainData.length} mẫu | Tập Test: ${testData.length} mẫu`);

  // Nạp dữ liệu vào mô hình
  trainData.forEach(item => {
    manager.addDocument('vi', item.text, item.intent);
  });

  console.log('⚙️ Đang huấn luyện mạng nơ-ron NLU (Epochs training)...');
  const startTime = Date.now();
  await manager.train();
  const trainTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Huấn luyện hoàn tất trong ${trainTime} giây!`);

  // Lưu file weights model.nlp
  const modelSavePath = path.join(__dirname, 'model.nlp');
  manager.save(modelSavePath);
  console.log(`💾 Đã lưu trọng số mô hình đã huấn luyện tại: ${modelSavePath}`);

  // Đánh giá mô hình trên tập Test độc lập
  console.log('\n================ ĐÁNH GIÁ TRÊN TẬP TEST ĐỘC LẬP ================');
  let correct = 0;
  const confusionMatrix = {};
  const intentsList = [...new Set(rawData.map(d => d.intent))];

  intentsList.forEach(actual => {
    confusionMatrix[actual] = {};
    intentsList.forEach(pred => {
      confusionMatrix[actual][pred] = 0;
    });
  });

  for (const sample of testData) {
    const result = await manager.process('vi', sample.text);
    const predicted = result.intent;
    const actual = sample.intent;

    if (predicted === actual) {
      correct++;
    }
    if (confusionMatrix[actual] && confusionMatrix[actual][predicted] !== undefined) {
      confusionMatrix[actual][predicted]++;
    }
  }

  const accuracy = ((correct / testData.length) * 100).toFixed(2);
  console.log(`🎯 ĐỘ CHÍNH XÁC (Accuracy trên tập Test): ${accuracy}% (${correct}/${testData.length} mẫu đúng)`);

  console.log('\n📊 MA TRẬN NHẦM LẪN (Confusion Matrix):');
  console.table(confusionMatrix);

  // Thử nghiệm dự đoán một số câu hỏi thực tế
  console.log('\n--- THỬ NGHIỆM INFERENCE CÁC CÂU HỎI THỰC TẾ ---');
  const demoQueries = [
    'tôi là ai và hôm nay tôi bán được bao nhiêu tiền',
    'quy chuẩn bọc thùng xốp linh kiện pc gaming khi giao xa',
    'tra cứu tiến độ đơn hàng DH-1002',
    'card rtx 4070 trong kho còn bao nhiêu cái',
    'i5 13400 + rtx 4060 cần nguồn bao nhiêu watt',
    'báo cáo doanh thu thực tế hôm nay của công ty'
  ];

  for (const q of demoQueries) {
    const res = await manager.process('vi', q);
    console.log(`Câu hỏi: "${q}"`);
    console.log(`  --> Dự đoán Intent: ${res.intent} (Độ tin cậy Confidence: ${(res.score * 100).toFixed(1)}%)\n`);
  }

  console.log('🎉 Hoàn thành xuất sắc toàn bộ quy trình Train AI cục bộ!');
}

trainLocalNlp().catch(console.error);
