"use client";
import { Button } from "@/components/ui/button";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Mic, StopCircle, Loader2, Camera, CameraOff } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/utils/db";
import { UserAnswer } from "@/utils/schema";
import { useUser } from "@clerk/nextjs";
import moment from "moment";

const RecordAnswerSection = ({ 
  mockInterviewQuestion, 
  activeQuestionIndex, 
  interviewData, 
  onAnswerSave,
}) => {
  const [userAnswer, setUserAnswer] = useState("");
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef(null);
  const webcamRef = useRef(null);
  const isRecordingRef = useRef(false); // track recording state for callbacks

  // Keep isRecordingRef in sync
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // Attach stream to video element whenever stream or ref changes
  useEffect(() => {
    if (webcamRef.current && webcamStream) {
      webcamRef.current.srcObject = webcamStream;
    }
  }, [webcamStream, webcamEnabled]);

  // Cleanup webcam stream on unmount
  useEffect(() => {
    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [webcamStream]);

  // Check if SpeechRecognition is available
  useEffect(() => {
    const SpeechRecognition = 
      typeof window !== "undefined" && 
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  // Create a fresh SpeechRecognition instance
  const createRecognition = useCallback(() => {
    const SpeechRecognition = 
      typeof window !== "undefined" && 
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }

      if (finalTranscript.trim()) {
        setUserAnswer(prev => (prev + ' ' + finalTranscript).trim());
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      
      if (event.error === 'not-allowed') {
        toast.error("Microphone access denied", {
          description: "Please allow microphone access in your browser settings and try again.",
          duration: 5000,
        });
      } else if (event.error === 'network') {
        toast.error("Speech recognition network error", {
          description: "Could not connect to speech recognition service. Please check your internet connection and try again.",
          duration: 5000,
        });
      } else if (event.error === 'no-speech') {
        toast.info("No speech detected", {
          description: "Please speak clearly into your microphone.",
          duration: 3000,
        });
      } else if (event.error !== 'aborted') {
        toast.error(`Speech recognition error: ${event.error}`, {
          description: "You can type your answer in the text box below.",
        });
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      // If we're still supposed to be recording, restart (Chrome stops after ~60s of silence)
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.error("Failed to restart recognition:", e);
          setIsRecording(false);
        }
      } else {
        setIsRecording(false);
      }
    };

    return recognition;
  }, []);

  const EnableWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setWebcamStream(stream);
      setWebcamEnabled(true);
      toast.success("Webcam enabled successfully");
    } catch (error) {
      toast.error("Failed to enable webcam", {
        description: "Please check your camera permissions"
      });
      console.error("Webcam error:", error);
    }
  };

  const DisableWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }
    setWebcamEnabled(false);
  };

  const StartStopRecording = async () => {
    if (!speechSupported) {
      toast.error("Speech-to-text not supported in this browser", {
        description: "You can type your answer in the text box below."
      });
      return;
    }

    if (isRecording) {
      // Stop recording
      if (recognitionRef.current) {
        isRecordingRef.current = false;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsRecording(false);
      toast.info("Recording stopped");
    } else {
      // Request microphone permission first
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the permission stream immediately - we just needed the permission
        micStream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error("Mic permission error:", err);
        toast.error("Microphone access denied", {
          description: "Please allow microphone permission in your browser settings and reload the page.",
          duration: 5000,
        });
        return;
      }

      // Create a fresh recognition instance each time
      const recognition = createRecognition();
      if (!recognition) {
        toast.error("Speech recognition not available", {
          description: "You can type your answer in the text box below."
        });
        return;
      }

      recognitionRef.current = recognition;

      try {
        recognition.start();
        setIsRecording(true);
        isRecordingRef.current = true;
        toast.info("Recording started — speak clearly into your microphone");
      } catch (error) {
        toast.error("Could not start recording", {
          description: "You can type your answer in the text box instead."
        });
        console.error("Recording start error:", error);
      }
    }
  };

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        isRecordingRef.current = false;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  const UpdateUserAnswer = async () => {
    if (!userAnswer.trim()) {
      toast.error("Please provide an answer");
      return;
    }

    setLoading(true);

    // Stop recording if active
    if (isRecording && recognitionRef.current) {
      isRecordingRef.current = false;
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
    }

    try {
      const feedbackResponse = await fetch('/api/generate-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          question: mockInterviewQuestion[activeQuestionIndex]?.question,
          userAnswer: userAnswer,
        }),
      });

      if (!feedbackResponse.ok) {
        throw new Error('Failed to get feedback from AI');
      }

      const JsonfeedbackResp = await feedbackResponse.json();

      const answerRecord = {
        mockIdRef: interviewData?.mockId,
        question: mockInterviewQuestion[activeQuestionIndex]?.question,
        correctAns: mockInterviewQuestion[activeQuestionIndex]?.answer,
        userAns: userAnswer,
        feedback: JsonfeedbackResp?.feedback,
        rating: JsonfeedbackResp?.rating,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        createdAt: moment().format("DD-MM-YYYY"),
      };

      await db.insert(UserAnswer).values(answerRecord);

      onAnswerSave?.(answerRecord);

      toast.success("Answer recorded successfully");
      
      setUserAnswer("");
    } catch (error) {
      toast.error("Failed to save answer", {
        description: error.message
      });
      console.error("Answer save error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center flex-col relative">
      {loading && (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex flex-col justify-center items-center">
          <Loader2 className="h-16 w-16 animate-spin text-white mb-4" />
          <p className="text-white text-lg">Saving your answer...</p>
        </div>
      )}
      <div className="flex flex-col my-20 justify-center items-center bg-black rounded-lg p-5">
        {webcamEnabled ? (
          <video 
            ref={webcamRef} 
            autoPlay 
            playsInline
            muted
            className="w-[200px] h-[200px] object-cover rounded-lg"
          />
        ) : (
          <div className="w-[200px] h-[200px] flex justify-center items-center bg-gray-200 rounded-lg">
            <p className="text-gray-500">Webcam Disabled</p>
          </div>
        )}
        
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={webcamEnabled ? DisableWebcam : EnableWebcam}
        >
          {webcamEnabled ? (
            <>
              <CameraOff className="mr-2 h-4 w-4" /> Disable Webcam
            </>
          ) : (
            <>
              <Camera className="mr-2 h-4 w-4" /> Enable Webcam
            </>
          )}
        </Button>
      </div>

      <Button
        disabled={loading}
        variant="outline"
        className="my-10"
        onClick={StartStopRecording}
      >
        {isRecording ? (
          <h2 className="text-red-600 items-center animate-pulse flex gap-2">
            <StopCircle /> Stop Recording
          </h2>
        ) : (
          <h2 className="text-primary flex gap-2 items-center">
            <Mic /> Record Answer
          </h2>
        )}
      </Button>

      <textarea
        className="w-full h-32 p-4 mt-4 border rounded-md text-gray-800"
        placeholder="Type or speak your answer here..."
        value={userAnswer}
        onChange={(e) => setUserAnswer(e.target.value)}
      />
    
      <Button
        className="mt-4"
        onClick={UpdateUserAnswer}
        disabled={loading || !userAnswer.trim()}
      >
        {loading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
        ) : (
          "Save Answer"
        )}
      </Button>
    </div>
  );
};

export default RecordAnswerSection;