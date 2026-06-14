# Scientific papers

Đặt file PDF vào thư mục này. Tên file có thể ngẫu nhiên; khi build, website sẽ ưu
tiên đọc tiêu đề, tác giả và năm từ metadata của PDF.

Nếu PDF thiếu metadata hoặc cần trình bày chính xác hơn, tạo file JSON cùng tên:

- `ten-bat-ky.pdf`
- `ten-bat-ky.json`

Ví dụ:

```json
{
  "title": "Tên công trình nghiên cứu",
  "authors": ["Phạm Minh Duy", "Đồng tác giả"],
  "year": 2026,
  "type": "Journal Article",
  "venue": "Tên tạp chí hoặc hội nghị",
  "doi": "10.0000/example",
  "abstract": "Tóm tắt ngắn dùng trên portfolio.",
  "keywords": ["Machine Design", "AI", "Automation"],
  "featured": true
}
```

Sau khi thêm hoặc xóa paper, chạy `npm run papers:index` hoặc `npm run build`.
Thư mục `paper/` ở thư mục gốc cũng được hỗ trợ để tương thích.
