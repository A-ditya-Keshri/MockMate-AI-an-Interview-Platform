"use client";
import { Button } from "@/components/ui/button";
import React, { useEffect, useState, useRef } from "react";
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
  const recognitionRef = useRef(null);
  const webcamRef = useRef(null);

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

  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const initSpeechRecognition = () => {
    const SpeechRecognition = 
      typeof window !== "undefined" && 
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) return;

    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      retryCountRef.current = 0; // Reset retries on success
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
      if (event.error === 'network' && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`Speech recognition network error, retrying (${retryCountRef.current}/${maxRetries})...`);
        // Reinitialize and retry after a short delay
        setTimeout(() => {
          initSpeechRecognition();
          try {
            recognitionRef.current?.start();
          } catch (e) {
            console.error("Retry failed:", e);
            setIsRecording(false);
          }
        }, 500);
        return;
      }
      
      if (event.error === 'network') {
        toast.error("Voice recording unavailable on localhost (Chrome limitation)", {
          description: "Please type your answer in the text box below instead.",
          duration: 5000,
        });
      } else if (event.error !== 'aborted') {
        toast.error(`Speech recognition error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };
  };

  useEffect(() => {
    initSpeechRecognition();
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

  const StartStopRecording = () => {
    if (!recognitionRef.current) {
      toast.error("Speech-to-text not supported in this browser", {
        description: "You can type your answer in the text box below."
      });
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      toast.info("Recording stopped");
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        toast.info("Recording started");
      } catch (error) {
        toast.error("Could not start recording", {
          description: "You can type your answer in the text box instead."
        });
        console.error("Recording start error:", error);
      }
    }
  };

  const UpdateUserAnswer = async () => {
    if (!userAnswer.trim()) {
      toast.error("Please provide an answer");
      return;
    }

    setLoading(true);

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
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
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
        placeholder="Your answer will appear here..."
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