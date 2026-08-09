# Quản lý Sinh viên

Hệ thống quản lý **Sinh viên – Lớp – Sở thích** với frontend React và backend NestJS.  
Backend cũ ExpressJS vẫn được giữ lại để đối chiếu contract/regression trong quá trình migration.

## Kiến trúc

Backend NestJS được tổ chức theo hướng module hóa và Dependency Inversion:

```text
HTTP / Controller
      ↓
Application / Use Cases
      ↓
Ports / Abstractions
      ↑
Infrastructure / PostgreSQL / Storage
```

Các module chính:

- **Student**: CRUD, phân trang/tìm kiếm, soft delete/restore, copy, import/export, attachment.
- **Class**: CRUD, student count, membership, copy, import/export, xóa có kiểm tra sinh viên.
- **Hobby**: tạo hobby bằng bitmask, cấp `bit_value` an toàn, kiểm tra hobby đang được sử dụng.

Application layer không phụ thuộc trực tiếp vào SQL/PostgreSQL implementation; persistence được truy cập qua ports và NestJS Dependency Injection.

## Công nghệ

- **Frontend:** React 17, Redux, Redux-Saga, Ant Design
- **Backend chính:** NestJS 11, TypeScript
- **Backend legacy:** Node.js / ExpressJS
- **Database:** PostgreSQL
- **File storage:** Supabase Storage
- **Testing:** Jest, Supertest, dual-target API contract tests, Postman automated tests

## Chạy local

### 1. NestJS Backend — `http://localhost:3002`

```powershell
cd backend-nest
npm install
Copy-Item .env.example .env
npm run start:dev
```

Cấu hình `.env`:

```env
PORT=3002
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CORS_ALLOWED_ORIGINS=http://localhost:3001
```

> Không commit `.env` hoặc bất kỳ secret/key nào.

### 2. React Frontend — `http://localhost:3001`

```powershell
cd frontend/reactjs-template
npm ci --legacy-peer-deps
```

Tạo `.env.local`:

```env
PORT=3001
REACT_APP_API_BASE_URL=http://localhost:3002
```

Sau đó:

```powershell
npm start
```

Mở: **http://localhost:3001**

### 3. Legacy Express Backend — tùy chọn

Legacy backend chỉ cần khi chạy regression/contract comparison:

```powershell
cd backend
npm install
npm run dev
```

Mặc định chạy tại **http://localhost:3000**.

## Kiểm thử

Trong `backend-nest`:

```powershell
npm test
npm run test:e2e
npm run build
npm run test:contract
```

Contract harness hỗ trợ kiểm tra:

```text
legacy
nest
both
```

Ngoài ra project có Postman automated suites cho smoke test, validation, Cartesian/Pairwise combinations và regression các lỗi API đã phát hiện.

## Cấu trúc chính

```text
QuanLySinhVien/
├─ backend/                    # ExpressJS legacy
├─ backend-nest/               # NestJS backend chính
│  └─ src/modules/
│     ├─ student/
│     ├─ class/
│     └─ hobby/
└─ frontend/reactjs-template/  # React frontend
```

## Ghi chú

- Frontend local sử dụng NestJS tại port `3002`.
- `code` của Class là immutable sau khi tạo.
- Không được xóa Class đang có sinh viên.
- Student import/export hỗ trợ CSV, XLSX, JSON và XML.
- Hobby dùng bitmask; `bit_value` được backend tự cấp và giới hạn đến `2^30`.
