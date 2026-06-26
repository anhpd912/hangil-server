// Service email duy nhất — dùng Resend để gửi mail giao dịch (reset password, ...)
import { Resend } from "resend";
import type { Result } from "../lib/result.js";

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

export async function sendResetPasswordEmail(to: string, resetUrl: string): Promise<Result<void>> {
  try {
    const { error } = await getClient().emails.send({
      from: process.env.EMAIL_FROM ?? "Hangil <onboarding@resend.dev>",
      to,
      subject: "Đặt lại mật khẩu Hangil",
      html: `
        <p>Xin chào,</p>
        <p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản Hangil này.</p>
        <p><a href="${resetUrl}">Nhấn vào đây để đặt lại mật khẩu</a></p>
        <p>Nếu không phải bạn, hãy bỏ qua email này.</p>
      `,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lỗi không xác định khi gửi email",
    };
  }
}
