import fs from 'fs';
import path from 'path';

// Автоматически ищем VITE_API_URL в .env файле
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const match = envContent.match(/^VITE_API_URL=(.+)$/m);

if (!match) {
  console.error('❌ Ошибка: VITE_API_URL не найден в файле .env');
  process.exit(1);
}

// Очищаем URL от лишних пробелов, кавычек и символов \r (Windows-переносы)
const apiUrl = match[1].replace(/['"\r\n]/g, '').trim();
const fullUrl = `${apiUrl}/openapi.json`;
const outputPath = path.resolve(process.cwd(), 'api/openapi.json');

console.log(`📡 Скачиваю спецификацию из: ${fullUrl}...`);

fetch(fullUrl)
  .then(res => {
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  })
  .then(data => {
    // Проверяем существование папки перед записью
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log('✅ Файл openapi.json успешно сохранен!');
  })
  .catch(err => {
    console.error('❌ Не удалось скачать файл:', err.message);
    process.exit(1);
  });
