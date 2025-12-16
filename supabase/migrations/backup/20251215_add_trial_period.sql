-- Add 'trialing' to the status check constraint safely
-- Postgres doesn't allow easy modification of check constraints, so we drop and re-add
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check 
    CHECK (status IN ('active', 'pending', 'cancelled', 'past_due', 'trialing'));

-- Add trial_ends_at column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'trial_ends_at') THEN 
        ALTER TABLE subscriptions ADD COLUMN trial_ends_at TIMESTAMPTZ; 
    END IF; 
END $$;

-- Function to start a trial
CREATE OR REPLACE FUNCTION start_pro_trial(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub_id UUID;
    v_has_used_trial BOOLEAN;
BEGIN
    -- Check if user already has a subscription record
    SELECT id, (trial_ends_at IS NOT NULL) INTO v_sub_id, v_has_used_trial
    FROM subscriptions
    WHERE user_id = p_user_id;

    -- If user has already used trial/had a subscription with trial_ends_at set (even if null now? no, we set it when trial starts)
    -- Logic: if trial_ends_at is present, they used it.
    -- Wait, if they had a paid sub, trial_ends_at is NULL.
    -- Let's make it simple: We allow trial IF they are currently 'free' (or no sub) AND trial_ends_at IS NULL.
    
    IF v_sub_id IS NOT NULL THEN
       SELECT (trial_ends_at IS NOT NULL) INTO v_has_used_trial FROM subscriptions WHERE id = v_sub_id;
       
       IF v_has_used_trial THEN
           RETURN jsonb_build_object('success', false, 'message', 'Ya has utilizado tu prueba gratuita.');
       END IF;

       -- Update existing subscription to trial
       UPDATE subscriptions 
       SET status = 'trialing',
           plan_id = 'pro',
           trial_ends_at = NOW() + INTERVAL '15 days',
           updated_at = NOW()
       WHERE id = v_sub_id;
       
    ELSE
        -- Create new subscription entry for trial
        INSERT INTO subscriptions (user_id, plan_id, status, trial_ends_at)
        VALUES (p_user_id, 'pro', 'trialing', NOW() + INTERVAL '15 days');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;
