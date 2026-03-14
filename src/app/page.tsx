"use client";

import { useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

type Status = "idle" | "uploading" | "processing" | "done" | "error";
type Mode = "url" | "file";

export default function Home() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [videoUrl, setVideoUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  function startPolling(job_id: string) {
    const startTime = Date.now();
    // 경과 시간 카운터
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/status/${job_id}`);
        const data = await res.json();
        if (data.status === "done") {
          clearInterval(interval);
          clearInterval(timer);
          setVideoUrl(`${API_BASE}/video/${data.filename}`);
          setStatus("done");
        } else if (data.status === "error") {
          clearInterval(interval);
          clearInterval(timer);
          setStatus("error");
          setErrorMsg(data.message ?? "처리 중 오류 발생");
        } else if (data.progress !== undefined) {
          setProgress(data.progress);
        }
      } catch {
        clearInterval(interval);
        clearInterval(timer);
        setStatus("error");
        setErrorMsg("상태 확인 실패");
      }
    }, 3000);
  }

  async function handleUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setStatus("uploading");
    setErrorMsg("");
    setVideoUrl("");
    try {
      const res = await fetch(`${API_BASE}/process-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "요청 실패");
      setStatus("processing");
      startPolling(data.job_id);
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e.message);
    }
  }

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("video/")) {
      setStatus("error");
      setErrorMsg("영상 파일만 업로드 가능합니다");
      return;
    }
    setStatus("uploading");
    setErrorMsg("");
    setVideoUrl("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/process`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");
      setStatus("processing");
      startPolling(data.job_id);
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e.message);
    }
  }, []);

  const isLoading = status === "uploading" || status === "processing";

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold mb-3">⚽ Soccer Highlight Analyzer</h1>
        <p className="text-gray-400 text-lg">선수 추적 · 공 궤적 자동 시각화</p>
      </div>

      {!isLoading && status !== "done" && (
        <div className="w-full max-w-2xl">
          {/* 모드 탭 */}
          <div className="flex rounded-xl bg-gray-900 border border-gray-800 p-1 mb-6">
            {(["url", "file"] as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                  ${mode === m ? "bg-green-600 text-white" : "text-gray-400 hover:text-white"}`}>
                {m === "url" ? "🔗 YouTube URL" : "📁 파일 업로드"}
              </button>
            ))}
          </div>

          {mode === "url" && (
            <form onSubmit={handleUrl} className="flex gap-3">
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
              />
              <button type="submit" disabled={!url.trim()}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-40 rounded-xl px-6 py-3 font-semibold transition-colors">
                분석
              </button>
            </form>
          )}

          {mode === "file" && (
            <label
              className={`w-full border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-colors block
                ${dragging ? "border-green-400 bg-green-950" : "border-gray-700 hover:border-gray-500 bg-gray-900"}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <input type="file" accept="video/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <div className="text-5xl mb-4">🎬</div>
              <p className="font-semibold mb-2">드래그하거나 클릭해서 업로드</p>
              <p className="text-gray-500 text-sm">mp4, mov, avi · 최대 500MB</p>
            </label>
          )}
        </div>
      )}

      <div className="mt-8 w-full max-w-2xl">
        {isLoading && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin shrink-0" />
              <div>
                <p className="font-semibold">
                  {status === "uploading" ? "영상 불러오는 중..." : "GPU 분석 중..."}
                </p>
                <p className="text-gray-400 text-sm mt-0.5">
                  {status === "uploading"
                    ? "서버로 전송 중"
                    : elapsed < 30
                      ? `GPU 서버 시작 중... (${elapsed}초)`
                      : `YOLOv8 처리 중... (${elapsed}초 경과)`}
                </p>
              </div>
              <span className="ml-auto text-green-400 font-bold text-lg">
                {status === "processing" ? `${progress}%` : ""}
              </span>
            </div>

            {status === "processing" && (
              <>
                {/* 진행률 바 */}
                <div className="w-full bg-gray-800 rounded-full h-3 mb-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(progress, elapsed < 30 ? 0 : 2)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>
                    {progress === 0
                      ? elapsed < 30 ? "GPU 워밍업 중..." : "분석 시작 중..."
                      : `${progress}% 완료`}
                  </span>
                  <span>감지 → 추적 → 렌더링</span>
                </div>
              </>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="bg-red-950 border border-red-800 rounded-2xl p-6 text-center">
            <p className="text-red-300 mb-4">{errorMsg}</p>
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
              <div className="flex gap-3">
                <button onClick={() => { setStatus("idle"); setUrl(""); }}
                  className="bg-gray-700 hover:bg-gray-600 rounded-lg px-4 py-2 text-sm transition-colors">
                  새 영상 분석
                </button>
                <a href={videoUrl} download
                  className="bg-green-700 hover:bg-green-600 rounded-lg px-4 py-2 text-sm transition-colors">
                  다운로드
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {status === "idle" && (
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-2xl text-center">
          {[
            { icon: "🎯", title: "선수 추적", desc: "YOLOv8 + ByteTrack으로 모든 선수 추적" },
            { icon: "🔴", title: "공 궤적", desc: "공의 이동 경로를 trail로 시각화" },
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
