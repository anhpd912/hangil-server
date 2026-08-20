// Chuỗi số liệu theo ngày (giờ VN) cho biểu đồ dashboard.
// completed_at/created_at là `timestamp` không timezone và luôn lưu UTC, nên phải
// `at time zone 'UTC'` trước rồi mới đổi sang 'Asia/Ho_Chi_Minh' — bỏ bước đầu thì
// Postgres hiểu nhầm giá trị naive là giờ VN và lệch 7 tiếng.
import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";

export type DailyPoint = {
  /** YYYY-MM-DD theo giờ VN */
  date: string;
  lessonsCompleted: number;
  activeLearners: number;
  newUsers: number;
};

const VN_TIMEZONE = "Asia/Ho_Chi_Minh";

function vnDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TIMEZONE }).format(date);
}

/** Danh sách ngày (cũ → mới) kết thúc ở hôm nay theo giờ VN. */
function lastNDateKeys(days: number): string[] {
  const keys: string[] = [];
  const now = Date.now();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    keys.push(vnDateKey(new Date(now - offset * 24 * 60 * 60 * 1000)));
  }
  return keys;
}

type CountRow = { day: string; value: number };

function toCountMap(rows: Iterable<CountRow>): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.day, Number(row.value));
  return map;
}

/**
 * Số liệu `days` ngày gần nhất. Mốc cắt lùi thêm 1 ngày rồi lọc lại theo key VN
 * để không rơi mất các bản ghi nằm trong ngày VN hiện tại nhưng lệch múi giờ UTC.
 */
export async function getDailyActivity(days: number): Promise<DailyPoint[]> {
  const dateKeys = lastNDateKeys(days);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [completions, actives, signups] = await Promise.all([
    db.execute<CountRow>(sql`
      select to_char((completed_at at time zone 'UTC') at time zone ${VN_TIMEZONE}, 'YYYY-MM-DD') as day,
             count(*)::int as value
      from user_progress
      where completed_at is not null and completed_at >= ${since}
      group by day
    `),
    db.execute<CountRow>(sql`
      select to_char((completed_at at time zone 'UTC') at time zone ${VN_TIMEZONE}, 'YYYY-MM-DD') as day,
             count(distinct user_id)::int as value
      from user_progress
      where completed_at is not null and completed_at >= ${since}
      group by day
    `),
    db.execute<CountRow>(sql`
      select to_char((created_at at time zone 'UTC') at time zone ${VN_TIMEZONE}, 'YYYY-MM-DD') as day,
             count(*)::int as value
      from "user"
      where created_at >= ${since}
      group by day
    `),
  ]);

  const completionMap = toCountMap(completions.rows);
  const activeMap = toCountMap(actives.rows);
  const signupMap = toCountMap(signups.rows);

  return dateKeys.map((date) => ({
    date,
    lessonsCompleted: completionMap.get(date) ?? 0,
    activeLearners: activeMap.get(date) ?? 0,
    newUsers: signupMap.get(date) ?? 0,
  }));
}
