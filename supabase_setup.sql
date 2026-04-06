-- ================================================================
-- 헌터뷰 Supabase 초기 설정 SQL
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ================================================================

-- ── 1. applications 테이블 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  campaign_id      TEXT        NOT NULL,          -- data.json의 id (예: gangnam_12345)
  campaign_title   TEXT        NOT NULL,
  campaign_link    TEXT        DEFAULT '',
  campaign_platform TEXT       DEFAULT '',
  status           TEXT        DEFAULT '신청완료', -- 신청완료 / 선정됨 / 후기작성중 / 완료
  applied_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, campaign_id)                    -- 동일 캠페인 중복 신청 방지
);

-- ── 2. Row Level Security (RLS) 설정 ──────────────────────────
-- RLS를 활성화하면 인증된 사용자만 본인 데이터에 접근 가능
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 조회
CREATE POLICY "Users can view own applications"
  ON applications FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 신청만 추가
CREATE POLICY "Users can insert own applications"
  ON applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 신청만 수정 (상태 변경)
CREATE POLICY "Users can update own applications"
  ON applications FOR UPDATE
  USING (auth.uid() = user_id);

-- 본인 신청만 삭제 (신청 취소)
CREATE POLICY "Users can delete own applications"
  ON applications FOR DELETE
  USING (auth.uid() = user_id);

-- ── 3. 인덱스 (조회 성능 향상) ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_applications_user_id
  ON applications(user_id);

CREATE INDEX IF NOT EXISTS idx_applications_campaign_id
  ON applications(campaign_id);
