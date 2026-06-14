# Phạm Minh Duy - Engineering Portfolio

Portfolio tĩnh dành cho hồ sơ kỹ sư thiết kế máy, nghiên cứu, AI và tự động hóa.

## Chạy tại máy

Mở `index.html` trực tiếp hoặc dùng một static HTTP server.

## Thêm nhạc

1. Đặt file `.mp3` với tên bất kỳ vào `assets/music/`.
2. Chạy `npm run music:index` hoặc `npm run build`.
3. Player tự đọc ID3, xáo trộn playlist và chuyển bài ngẫu nhiên.

## Thêm bài báo khoa học

1. Đặt PDF với tên bất kỳ vào `papers/` hoặc `paper/`.
2. Chạy `npm run papers:index` hoặc `npm run build`.
3. Website tự tạo mục công bố từ metadata PDF, tên file và cấu trúc thư mục.

Nếu PDF thiếu metadata, thêm file JSON cùng tên, ví dụ `abc.pdf` và `abc.json`.
Mẫu đầy đủ nằm tại `papers/README.md`.

## Tự động cập nhật GitHub Pages

Workflow `.github/workflows/pages.yml` chạy `npm run build` mỗi khi push lên nhánh
`main` hoặc `master`, sau đó deploy website. Trong phần Pages của repository, chọn
nguồn triển khai là **GitHub Actions**.

## Kiểm tra

```bash
npm run check
```
