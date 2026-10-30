import React, { useState } from "react";
import { X, Star, ThumbsUp } from "lucide-react";
import { Booking } from "../types";
import { useToast } from "../context/ToastContext";

interface ReviewModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ booking, isOpen, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([
    "Punctual Arrival",
    "Professional Workmanship",
    "Clean Worksite",
  ]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !booking) return null;

  const availableTags = [
    "Punctual Arrival",
    "Professional Workmanship",
    "Clean Worksite",
    "Expert Diagnostician",
    "Fair Transparent Pricing",
    "Quick Resolution",
  ];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${booking.bookingId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("dg_token")}`,
        },
        body: JSON.stringify({
          rating,
          comment,
          qualityTags: selectedTags,
        }),
      });

      if (res.ok) {
        showToast("Review submitted successfully! Thank you for your feedback.", "success");
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to submit review", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error submitting review", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div>
            <h3 className="font-bold text-base">Rate Completed Service</h3>
            <p className="text-xs text-slate-400">Ref: {booking.bookingReference}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-center">
            <div className="text-xs font-semibold text-slate-500 mb-2">How was your experience with {booking.assignedTechnicianName || "the technician"}?</div>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 focus:outline-none transition transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="text-xs font-bold text-amber-600 mt-1">
              {rating === 5 && "Outstanding Excellence!"}
              {rating === 4 && "Very Good Service"}
              {rating === 3 && "Average"}
              {rating === 2 && "Needs Improvement"}
              {rating === 1 && "Poor Experience"}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Service Highlights</label>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                    selectedTags.includes(tag)
                      ? "border-blue-600 bg-blue-50 text-blue-900 font-semibold"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Written Feedback</label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us about the technician's punctuality, technical skill, and diagnostic precision..."
              className="w-full text-xs rounded-xl border-slate-200 bg-slate-50 p-2.5 focus:bg-white"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <ThumbsUp className="w-3.5 h-3.5" /> Submit Review
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
