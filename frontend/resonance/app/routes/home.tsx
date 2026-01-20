import { act, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router";

interface ContextType {
  socket: WebSocket;
  audio: AudioContext;
  isReady: boolean;
}

interface AudioInformation {
  title: string;
  size: number;
  duration: number;
}

enum Actions {
  PLAY = "PLAY",
  PAUSE = "PAUSE",
  SEEK = "SEEK",
  NEW_TRACK = "NEW_TRACK",
}

interface Message {
  action: Actions;
  payload: AudioInformation;
}

interface SongListMessage {
  songs: string[];
}

interface SongRequest {
  title: string;
}

export default function Home() {
  const { socket, audio, isReady } = useOutletContext<ContextType>();

  const audioSource = useRef<AudioBufferSourceNode>(null); // useRef data persists through rerenders (also updats synchronously)
  const audioBuffer = useRef<AudioBuffer>(null);
  const startTime = useRef<number>(0);
  const pauseOffset = useRef(0);
  const animationFrameID = useRef<number>(0);
  const previousStartTime = useRef<number>(0);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [library, setLibrary] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioVisualProgress, setAudioVisualProgress] = useState<number>(0);

  useEffect(() => {
    if (!isReady) return;

    socket.addEventListener("message", (event) => {
      try {
        const response: SongListMessage = JSON.parse(event.data);
        setLibrary(response.songs);
        console.log(response);
      } catch (err) {
        console.error("Failed to parse socket message", err);
      }
    });
  }, [isReady]);

  useEffect(() => {
    const updateAudioScrollView = () => {
      if (!isPlaying || !audio) return;

      const currTime = audio.currentTime;
      const currProgress = pauseOffset.current + (currTime - startTime.current);

      // console.log(currProgress);
      setAudioVisualProgress(currProgress);

      animationFrameID.current = requestAnimationFrame(updateAudioScrollView);
    };

    if (isPlaying) {
      animationFrameID.current = requestAnimationFrame(updateAudioScrollView);
    } else {
      cancelAnimationFrame(animationFrameID.current);
    }

    return () => {
      cancelAnimationFrame(animationFrameID.current);
    };
  }, [isPlaying]);

  const sendAudioStatus = async (title: string, action: Actions) => {
    const audioInfo: AudioInformation = {
      title: title,
      duration: audioBuffer.current!.duration,
      size: audioBuffer.current!.length,
    };
    const message: Message = { action: action, payload: audioInfo };
    await fetch(`http://localhost:8080/action?title=${title}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
  };

  const onAudioFileInput = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!event.target.files || event.target.files.length < 0) {
      return;
    }

    setSelectedFile(event.target.files[0]); // useState state update is asynchronous.

    const file = event.target.files[0];
    const blob = await file?.arrayBuffer();

    if (!blob) {
      console.log("Error");
      setErrorMessage("Error extracting audio file");
      return;
    }

    const audioBuffer = await audio.decodeAudioData(blob);

    const audioInfo: AudioInformation = {
      title: file.name,
      size: file.size,
      duration: audioBuffer.duration,
    };

    const message: Message = {
      action: Actions.NEW_TRACK,
      payload: audioInfo,
    };

    const messageJson = JSON.stringify(message);
    socket.send(messageJson);

    console.log("Sent message to server");

    const audioSource = audio.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(audio.destination);
    audioSource.start();
    await audio.resume();
  };

  const onAudioPlay = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isPlaying && audioSource.current) {
      audioSource.current.onended = null;
      audioSource.current.stop();
      audioSource.current = null;

      pauseOffset.current += audio.currentTime - startTime.current;
      setIsPlaying(false);
      return;
    }

    if (audioBuffer.current === null) {
      if (!event.currentTarget.name) {
        console.error("Failed to get song name");
        return;
      }

      try {
        const response = await fetch(
          `http://localhost:8080/get-audio?title=${event.currentTarget.name}`,
          {
            method: "GET",
          },
        );

        const arrayBuffer = await response.arrayBuffer();
        audioBuffer.current = await audio.decodeAudioData(arrayBuffer);
      } catch (err) {
        console.error("Failed to retrieve song", err);
      }
    }

    try {
      audioSource.current = audio.createBufferSource();
      audioSource.current.onended = () => setIsPlaying(false);
      audioSource.current.buffer = audioBuffer.current;
      audioSource.current.connect(audio.destination);
      startTime.current = audio.currentTime;
      audioSource.current.start(0, pauseOffset.current);
      await audio.resume();

      setIsPlaying(true);
    } catch (err) {
      console.error("Failed to play song", err);
    }
  };

  const onAudioSeek = async (time: number) => {
    console.log("seek");
    if (audioSource.current) {
      audioSource.current.onended = null;
      audioSource.current.stop();
      audioSource.current = null;
    }

    pauseOffset.current = time;
    startTime.current = audio.currentTime;
    setAudioVisualProgress(pauseOffset.current);

    if (isPlaying) {
      audioSource.current = audio.createBufferSource();
      audioSource.current.onended = () => setIsPlaying(false);
      audioSource.current.buffer = audioBuffer.current;
      audioSource.current.connect(audio.destination);
      audioSource.current.start(0, pauseOffset.current);

      setIsPlaying(true);
    }
  };

  return (
    <div className="home-root">
      <ul>
        {library.map((song) => (
          <li key={song}>
            {song}{" "}
            <button name={song} onClick={onAudioPlay}>
              Play
            </button>
          </li>
        ))}
      </ul>
      <input
        type="range"
        min="0"
        max={audioBuffer.current?.duration || 0}
        value={audioVisualProgress}
        onChange={(e) => onAudioSeek(parseFloat(e.target.value))}
      />
      {/* onPointerUp to remove double inputs */}

      <p>{audioBuffer.current?.duration}</p>
      <input
        type="file"
        accept=".mp3, .flac, .wav"
        onChange={onAudioFileInput}
        multiple
      />

      <button type="button">Play</button>
    </div>
  );
}
