
-- =====================================================
-- SAAPayment - Full Schema
-- =====================================================

-- Enum role
CREATE TYPE public.app_role AS ENUM ('admin', 'parent');

-- Enum invoice/payment status
CREATE TYPE public.invoice_status AS ENUM ('unpaid', 'partial', 'paid', 'expired');
CREATE TYPE public.payment_status AS ENUM ('pending', 'settlement', 'capture', 'expire', 'cancel', 'deny', 'failure', 'refund');

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ---------- profiles ----------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_own_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_own_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- user_roles ----------
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_self_select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- Auto-create profile + default parent role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  );
  -- Default role: parent (admin must be granted manually)
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'parent');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- academic_years ----------
CREATE TABLE public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.academic_years TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.academic_years TO authenticated;
GRANT ALL ON public.academic_years TO service_role;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ay_read_auth" ON public.academic_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "ay_admin_write" ON public.academic_years FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_ay_updated BEFORE UPDATE ON public.academic_years FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- classes ----------
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  homeroom_teacher TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "classes_read" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "classes_admin_write" ON public.classes FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_classes_updated BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- billing_types ----------
CREATE TABLE public.billing_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  default_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_types TO authenticated;
GRANT ALL ON public.billing_types TO service_role;
ALTER TABLE public.billing_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bt_read" ON public.billing_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "bt_admin_write" ON public.billing_types FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_bt_updated BEFORE UPDATE ON public.billing_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- students ----------
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nis TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  parent_whatsapp TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_parent ON public.students(parent_id);
CREATE INDEX idx_students_class ON public.students(class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students_admin_all" ON public.students FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "students_parent_read" ON public.students FOR SELECT TO authenticated
  USING (parent_id = auth.uid());
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- invoice_number sequence ----------
CREATE SEQUENCE public.invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE n BIGINT;
BEGIN
  n := nextval('public.invoice_number_seq');
  RETURN 'INV-' || to_char(now(), 'YYYYMM') || '-' || lpad(n::text, 6, '0');
END; $$;

-- ---------- invoices ----------
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE DEFAULT public.generate_invoice_number(),
  name TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  billing_type_id UUID REFERENCES public.billing_types(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  description TEXT,
  status public.invoice_status NOT NULL DEFAULT 'unpaid',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_student ON public.invoices(student_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due ON public.invoices(due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_admin_all" ON public.invoices FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "inv_parent_read" ON public.invoices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = invoices.student_id AND s.parent_id = auth.uid()));
CREATE TRIGGER trg_inv_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- payments ----------
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL UNIQUE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_type TEXT,
  transaction_id TEXT,
  transaction_status public.payment_status NOT NULL DEFAULT 'pending',
  fraud_status TEXT,
  snap_token TEXT,
  snap_redirect_url TEXT,
  raw_response JSONB,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX idx_payments_status ON public.payments(transaction_status);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pay_admin_all" ON public.payments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "pay_parent_read" ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.students s ON s.id = i.student_id
    WHERE i.id = payments.invoice_id AND s.parent_id = auth.uid()
  ));
CREATE TRIGGER trg_pay_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- receipts ----------
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_code TEXT NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
GRANT SELECT ON public.receipts TO anon; -- for public QR verification
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rec_verify_anon" ON public.receipts FOR SELECT TO anon USING (true);
CREATE POLICY "rec_admin_all" ON public.receipts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "rec_parent_read" ON public.receipts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.students s ON s.id = i.student_id
    WHERE i.id = receipts.invoice_id AND s.parent_id = auth.uid()
  ));

-- ---------- notifications ----------
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_own_update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ---------- activity_logs ----------
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_logs_created ON public.activity_logs(created_at DESC);
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_admin_read" ON public.activity_logs FOR SELECT TO authenticated USING (public.is_admin());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Seed default billing types & active academic year
INSERT INTO public.academic_years (name, is_active) VALUES ('2025/2026', true);
INSERT INTO public.billing_types (name, default_amount, description) VALUES
  ('SPP Bulanan', 500000, 'Iuran bulanan'),
  ('Uang Gedung', 5000000, 'Uang pembangunan'),
  ('Seragam', 750000, 'Seragam sekolah'),
  ('Kegiatan Sekolah', 300000, 'Outing, market day, dll'),
  ('Ujian', 250000, 'Biaya ujian'),
  ('Lainnya', 0, 'Tagihan lain-lain');
