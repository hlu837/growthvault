-- Insert early withdrawal penalty setting (admin-controlled)
-- Default: 10%
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('early_withdrawal_penalty', 10, 'Early withdrawal penalty percentage applied to vaults withdrawn before maturity. Set by Super Admin.')
ON CONFLICT (setting_key) DO NOTHING;
