"use client";

import { useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

type Status = "idle" | "uploading" | "processing" | "done" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [videoUrl, setVideoUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState("");
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("video/")) {
      setStatus("error");
      setErrorMsg("영상 파일만 업로드 가능합니다 (mp4, mov 등)");
      return;
    }
    setStatus("uploading");
    setVideoUrl("");
    setErrorMsg("");
    setProgress("업로드 중...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/process`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "업로드 실패");
      }

      const { job_id } = await res.json();
      setStatus("processing");
      setProgress("GPU 분석 중...");
      pollStatus(job_id);
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e.message ?? "업로드 실패");
    }
  }, []);

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
        setErrorMsg("상태 확인 실패");
      }
    }, 3000);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const isLoading = status === "uploading" || status === "processing";

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-4 py-16">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-3">⚽ Soccer Highlight Analyzer</h1>
        <p className="text-gray-400 text-lg">
          축구 하이라이트 영상을 업로드하면 선수 추적 + 공 궤적을 자동으로 시각화합니다
        </p>
      </div>

      {/* 업로드 영역 */}
      {!isLoading && status !== "done" && (
        <label
          className={`w-full max-w-2xl border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors
            ${dragging ? "border-green-400 bg-green-950" : "border-gray-700 hover:border-gray-500 bg-gray-900"}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="text-5xl mb-4">🎬</div>
          <p className="text-lg font-semibold mb-2">영상 파일을 드래그하거나 클릭해서 업로드</p>
          <p className="text-gray-500 text-sm">mp4, mov, avi · 최대 500MB</p>
        </label>
      )}

      <div className="mt-8 w-full max-w-2xl">
        {isLoading && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-lg font-semibold mb-2">{progress}</p>
            <p className="text-gray-400 text-sm">
              {status === "uploading"
                ? "서버로 영상을 전송하고 있습니다..."
                : "GPU에서 YOLOv8으로 분석 중입니다. 1~5분 소요됩니다."}
            </p>
            {status === "processing" && (
              <div className="mt-4 flex justify-center gap-2 text-xs text-gray-600">
                <span>감지</span><span>→</span><span>추적</span><span>→</span><span>렌더링</span>
              </div>
            )}
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
              <div className="flex gap-3">
                <button onClick={() => setStatus("idle")}
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
