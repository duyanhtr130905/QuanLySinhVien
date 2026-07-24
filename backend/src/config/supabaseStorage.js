const { createClient } = require('@supabase/supabase-js');

// Tạo Supabase client CHỈ dùng cho Storage — DB vẫn dùng pg Pool như cũ.
// SERVICE_ROLE_KEY có quyền cao — KHÔNG bao giờ expose ra frontend.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = supabase;
