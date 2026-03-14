"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

type Status = "idle" | "processing" | "done" | "error";

export default function Home() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [videoUrl, setVideoUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setStatus("processing");
    setVideoUrl("");
    setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const { call_id } = await res.json();
      pollStatus(call_id);
    } catch {
      setStatus("error");
      setErrorMsg("서버 연결 실패. 잠시 후 다시 시도해주세요.");
    }
  }

  function pollStatus(call_id: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/status/${call_id}`);
        const data = await res.json();
        if (data.status === "done") {
          clearInterval(interval);
          setVideoUrl(`${API_BASE}/video/${data.filename}`);
          setStatus("done");
        } else if (data.status === "error") {
          clearInterval(interval);
          setStatus("error");
          setErrorMsg(data.message ?? "처리 중 오류 발생");
        }
      } catch {
        clearInterval(interval);
        setStatus("error");
        setErrorMsg("상태 확인 실패.");
      }
    }, 3000);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-16">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-3">⚽ Soccer Highlight Analyzer</h1>
        <p className="text-gray-400 text-lg">
          YouTube 하이라이트 링크를 넣으면 선수 추적 + 공 궤적을 자동으로 시각화합니다
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-2xl flex gap-3">
        <input
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={status === "processing"}
          className="flex-1 rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === "processing" || !url.trim()}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl px-6 py-3 font-semibold transition-colors"
        >
          분석
        </button>
      </form>

      <div className="mt-10 w-full max-w-2xl">
        {status === "processing" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-lg font-semibold mb-2">영상 분석 중...</p>
            <p className="text-gray-400 text-sm">GPU에서 처리 중입니다. 1~5분 소요됩니다.</p>
            <div className="mt-4 flex justify-center gap-2 text-xs text-gray-600">
              <span>다운로드</span><span>→</span><span>감지</span><span>→</span>
              <span>추적</span><span>→</span><span>렌더링</span>
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="bg-red-950 border border-red-800 rounded-2xl p-6 text-center">
            <p className="text-red-400 mb-4">{errorMsg}</p>
            <button onClick={() => setStatus("idle")}
              className="bg-red-700 hover:bg-red-600 rounded-lg px-4 py-2 text-sm transition-colors">
              다시 시도
            </button>
          </div>
        )}
        {status === "done" && videoUrl && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <video src={videoUrl} controls autoPlay className="w-full" />
            <div className="p-4 flex justify-between items-center">
              <span className="text-green-400 font-semibold">✅ 분석 완료!</span>
              <a href={videoUrl} download
                className="bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-2 text-sm transition-colors">
                다운로드
              </a>
            </div>
          </div>
        )}
      </div>

      {status === "idle" && (
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-2xl text-center">
          {[
            { icon: "🎯", title: "선수 추적", desc: "YOLOv8 + ByteTrack으로 모든 선수 실시간 추적" },
            { icon: "🔴", title: "공 궤적", desc: "공의 이동 경로를 trail 효과로 시각화" },
            { icon: "🎨", title: "팀 색상 구분", desc: "유니폼 색상으로 팀 자동 분리" },
          ].map((f) => (
            <div key={f.title} className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <div className="text-3xl mb-3">{f.icon}</div>
              <div className="font-semibold mb-2">{f.title}</div>
              <div className="text-gray-400 text-sm">{f.desc}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
