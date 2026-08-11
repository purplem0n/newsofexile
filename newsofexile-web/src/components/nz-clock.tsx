import { useEffect, useState } from "react";
import { formatNzClock } from "@/lib/datetime";

export function NzClock() {
  const [time, setTime] = useState(() => formatNzClock(new Date()));

  useEffect(() => {
    const update = () => setTime(formatNzClock(new Date()));
    update();

    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    let interval: number | undefined;

    const timeout = window.setTimeout(() => {
      update();
      interval = window.setInterval(update, 60_000);
    }, msUntilNextMinute);

    return () => {
      window.clearTimeout(timeout);
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
    };
  }, []);

  return (
    <time
      dateTime={new Date().toISOString()}
      className="text-[10px] tabular-nums text-zinc-400 whitespace-nowrap"
      title="New Zealand time (GGG headquarters)"
    >
      {time}
    </time>
  );
}
