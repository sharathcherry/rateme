import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BottomNavBar } from '../components/BottomNavBar';
import { Star } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, limit } from 'firebase/firestore';

interface RatingData {
  id: string;
  raterId?: string;
  targetId?: string;
  score?: number;
  comment?: string;
  createdAt?: any;
  targetProfile?: any;
}

function formatTimeAgo(timestamp: any) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;
  return `${Math.floor(diffInMonths / 12)}y ago`;
}

export default function Ratings() {
  const [ratings, setRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyRatings = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, 'ratings'),
          where('raterId', '==', auth.currentUser.uid),
          limit(50)
        );
        const snapshot = await getDocs(q);
        
        // Use a local cache to avoid fetching the same targetProfile multiple times
        const profileCache: Record<string, any> = {};
        
        // Execute profile fetches concurrently using Promise.all
        const ratingsData = await Promise.all(snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          let targetProfile = null;
          
          if (data.targetId) {
            if (profileCache[data.targetId]) {
              targetProfile = profileCache[data.targetId];
            } else {
              try {
                const profileSnap = await getDoc(doc(db, 'publicProfiles', data.targetId));
                if (profileSnap.exists()) {
                  targetProfile = profileSnap.data();
                  profileCache[data.targetId] = targetProfile;
                }
              } catch (e) {
                console.error("Error fetching target profile", e);
              }
            }
          }
          
          return {
            id: docSnap.id,
            ...data,
            targetProfile
          } as RatingData;
        }));
        
        // Sort by createdAt descending in memory
        ratingsData.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });

        setRatings(ratingsData);
      } catch (error) {
        console.error("Error fetching ratings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMyRatings();
  }, []);

  return (
    <main className="pt-16 pb-32 px-5 w-full max-w-[760px] mx-auto min-h-screen bg-[#0F0F11]">
      <header className="py-2 mb-6">
        <h1 className="text-[32px] font-bold tracking-tight text-[#F0EEE8]">My Ratings</h1>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-[#8A8894]">Loading your ratings...</div>
      ) : ratings.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <div className="w-20 h-20 rounded-full bg-[#1A1A1F] flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
            <Star className="text-[#353437]" size={36} />
          </div>
          <h2 className="text-[22px] font-bold text-[#F0EEE8] mb-3 tracking-tight">No ratings yet</h2>
          <p className="text-[15px] text-[#8A8894] max-w-[250px] leading-relaxed mb-8">You haven't rated anyone yet. Go to the feed to start rating profiles!</p>
          <Link to="/browse" className="h-[52px] px-8 rounded-full bg-sunset-gradient shadow-[0_4px_20px_rgba(255,107,107,0.3)] text-white font-bold text-[16px] flex items-center justify-center active:scale-95 transition-transform">
            Go to Feed
          </Link>
        </div>
      ) : (
        <div className="space-y-6 mt-2">
          {/* We combine all into one list for now but style it like the screenshot */}
          <div className="space-y-3">
            {ratings.map(rating => (
              <div key={rating.id} className="bg-[#1C1C1E] rounded-[20px] p-4 flex items-center gap-4">
                {/* Gradient Avatar Ring */}
                <div className="w-[60px] h-[60px] rounded-full bg-coral-gradient p-[2px] shrink-0">
                  <div className="w-full h-full rounded-full border-2 border-[#1C1C1E] overflow-hidden bg-[#2D1B4E]">
                    <img 
                      src={rating.targetProfile?.photos?.[0] || "https://picsum.photos/seed/user/100/100"} 
                      alt="Target" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex flex-col mb-0.5">
                    <span className="font-bold text-[#F0EEE8] text-[18px] tracking-tight">
                      {rating.targetProfile?.displayName || 'Unknown User'}
                    </span>
                    
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star 
                            key={i} 
                            className={i <= rating.score ? "text-[#FCA311]" : "text-[#353538]"} 
                            size={14} 
                            fill={i <= rating.score ? "currentColor" : "none"} 
                          />
                        ))}
                      </div>
                      <span className="text-[14px] text-[#F0EEE8] font-medium">{rating.score}</span>
                    </div>
                  </div>
                  
                  <span className="text-[13px] text-[#8A8894] font-medium">{formatTimeAgo(rating.createdAt)}</span>
                  
                  {rating.comment && (
                    <p className="text-[13px] text-[#D4D4D8] leading-relaxed mt-1 opacity-80">{rating.comment}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <BottomNavBar />
    </main>
  );
}
