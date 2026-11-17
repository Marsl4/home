// Spracheingabe (Mikrofon → Text) über die Spracherkennung des Browsers.
// Safari: braucht eingeschaltete Siri/Diktierfunktion. Gibt es sie nicht (z. B. in manchen installierten
// Web-Apps), bleibt die Diktier-Taste der iPad-Tastatur (Mikrofon-Symbol) – die funktioniert immer.
import { useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => Recognition;

function recognitionClass(): RecognitionConstructor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechInput(lang: string, onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });
  useEffect(() => () => recognition.current?.stop(), []);

  const supported = recognitionClass() !== null;

  const start = () => {
    const Klass = recognitionClass();
    if (!Klass) return;
    setError(null);
    const r = new Klass();
    r.lang = lang;
    r.interimResults = true; // Text erscheint schon beim Sprechen
    r.continuous = false;
    r.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");
      onTextRef.current(text);
    };
    r.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Kein Zugriff aufs Mikrofon – bitte erlauben (bzw. Siri/Diktieren einschalten) oder die Diktier-Taste der Tastatur nutzen.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setError("Die Spracherkennung hat nicht geklappt – nochmal versuchen oder tippen.");
      }
    };
    r.onend = () => setListening(false);
    recognition.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const stop = () => recognition.current?.stop();

  return { supported, listening, error, start, stop };
}
