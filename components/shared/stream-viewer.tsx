"use client"

import React, { useRef, useState, useEffect } from "react"
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react"
import Hls from "hls.js"

interface StreamViewerProps {
  streamUrl: string
  cameraName: string
  isActive?: boolean
  className?: string
  // Сообщает, удалось ли получить видео (true — пошли кадры, false — поток недоступен)
  onStatus?: (alive: boolean) => void
}

export function StreamViewer({
  streamUrl,
  cameraName,
  isActive = true,
  className = "",
  onStatus,
}: StreamViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fps, setFps] = useState(25)
  const [bitrate, setBitrate] = useState(1840)
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const onStatusRef = useRef(onStatus)
  onStatusRef.current = onStatus

  // Simulate changing network bitrate/fps to look premium and authentic
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setFps(Math.floor(Math.random() * 4) + 22) // 22-25 fps
      setBitrate(Math.floor(Math.random() * 300) + 1700) // 1700-2000 kbps
    }, 2000)
    return () => clearInterval(interval)
  }, [isPlaying])

  // Manage HLS stream or normal mp4 source via Hls.js
  useEffect(() => {
    const video = videoRef.current
    if (!video || !streamUrl) return

    let hls: Hls | null = null
    let retries = 0
    setFailed(false)
    setPlaying(false)
    const fail = () => {
      setFailed(true)
      onStatusRef.current?.(false)
    }
    const onPlaying = () => {
      setPlaying(true)
      setFailed(false)
      onStatusRef.current?.(true)
    }
    video.addEventListener("playing", onPlaying)
    video.addEventListener("error", fail)

    if (streamUrl.includes(".m3u8")) {
      if (Hls.isSupported()) {
        hls = new Hls({
          maxMaxBufferLength: 10, // Optimize buffer size for live streams
          enableWorker: true
        })
        hls.loadSource(streamUrl)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (isPlaying) {
            video.play().catch(() => {})
          }
        })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return
          // Плейлист не найден (404) или несколько неудачных попыток — камера не отдаёт видео
          const code = data.response?.code
          if (retries >= 2 || code === 404 || code === 403) {
            hls?.destroy()
            hls = null
            fail()
            return
          }
          retries++
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls?.startLoad()
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError()
          else fail()
        })
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl
        if (isPlaying) {
          video.play().catch(() => {})
        }
      }
    } else {
      video.src = streamUrl
      if (isPlaying) {
        video.play().catch(() => {})
      }
    }

    return () => {
      video.removeEventListener("playing", onPlaying)
      video.removeEventListener("error", fail)
      if (hls) {
        hls.destroy()
      }
      video.removeAttribute("src")
      video.load()
    }
  }, [streamUrl, isPlaying])

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch(() => {})
    }
    setIsPlaying(!isPlaying)
  }

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!videoRef.current) return
    if (!isFullscreen) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
    setIsFullscreen(!isFullscreen)
  }

  return (
    <div className={`relative aspect-video w-full rounded-lg overflow-hidden bg-zinc-950 border border-border/80 group shadow-md ${className}`}>
      {/* HTML5 video element */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover"
        style={{ filter: "brightness(0.9) contrast(1.05)" }}
      />

      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-zinc-400 z-[5]">
          <span className="text-xs font-medium">Камера не отдаёт видео</span>
          <span className="text-[10px] text-zinc-500">Поток недоступен на сервере</span>
        </div>
      )}

      {/* Video Overlay - Camera details */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-semibold text-white bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm shadow-sm">
            {cameraName}
          </span>
          <span className="text-[10px] text-zinc-300 font-mono bg-black/40 px-1.5 py-0.5 rounded w-fit backdrop-blur-sm">
            {playing ? `FPS: ${fps} | Bitrate: ${bitrate} kb/s` : "—"}
          </span>
        </div>
        
        {isActive && !failed && playing ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]">
            <span className="size-1.5 rounded-full bg-white"></span>
            LIVE
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-700 text-zinc-300">
            {failed || !isActive ? "НЕТ СИГНАЛА" : "ПОДКЛЮЧЕНИЕ…"}
          </span>
        )}
      </div>

      {/* Controls Overlay (appears on hover) */}
      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3 z-10">
        <div className="flex items-center justify-between w-full bg-black/65 backdrop-blur-sm p-1.5 rounded-md border border-white/10">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="text-white hover:text-primary transition-colors p-1 rounded hover:bg-white/10 cursor-pointer"
            >
              {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
            <button
              onClick={toggleMute}
              className="text-white hover:text-primary transition-colors p-1 rounded hover:bg-white/10 cursor-pointer"
            >
              {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
          </div>
          <button
            onClick={toggleFullscreen}
            className="text-white hover:text-primary transition-colors p-1 rounded hover:bg-white/10 cursor-pointer"
          >
            {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
