# Music assets

Đặt một hoặc nhiều file `.mp3` vào thư mục này. Tên file có thể là bất kỳ giá trị nào.

Sau khi thêm hoặc xóa nhạc, chạy:

```powershell
npm run music:index
```

Player sẽ đọc ID3 title/artist nếu file có metadata. Nếu không có, giao diện sẽ dùng
`Track 01`, `Track 02`, ... thay vì hiển thị tên file ngẫu nhiên.
