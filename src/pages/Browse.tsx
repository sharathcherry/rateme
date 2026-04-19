import { useState, useEffect } from 'react';
import { Star, Ban } from 'lucide-react';
import { BottomNavBar } from '../components/BottomNavBar';
import { db, auth } from '../firebase';
import { collection, getDocs, addDoc, serverTimestamp, query, where, limit, doc, updateDoc, increment, onSnapshot, setDoc } from 'firebase/firestore';

export default function Browse() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = onSnapshot(doc(db, 'publicProfiles', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUserProfile(docSnap.data());
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (!auth.currentUser) return;
      try {
        // Run completely independent queries in parallel to drastically improve network performance
        const [profilesSnap, ratingsSnap, blocksSnap] = await Promise.all([
          getDocs(query(collection(db, 'publicProfiles'), limit(150))),
          getDocs(query(collection(db, 'ratings'), where('raterId', '==', auth.currentUser.uid), limit(500))),
          getDocs(query(collection(db, 'blocks'), where('blockerId', '==', auth.currentUser.uid), limit(500)))
        ]);

        const allProfiles = profilesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const ratedIds = new Set(ratingsSnap.docs.map(doc => doc.data().targetId));
        const blockedIds = new Set(blocksSnap.docs.map(doc => doc.data().blockedId));

        // 3. Filter out self, rated profiles, and blocked profiles
        let unratedProfiles = allProfiles.filter(p => 
          p.id !== auth.currentUser?.uid && 
          !ratedIds.has(p.id) && 
          !blockedIds.has(p.id)
        );
        
        // 4. If no real profiles are available to rate, provide dummy profiles for demonstration
        if (unratedProfiles.length === 0) {
           const dummyProfiles = [
             {
               id: 'dummy_alex',
               displayName: 'Alex M, 24',
               location: 'Mumbai, IN',
               photos: ['https://picsum.photos/seed/alex1/800/1000', 'https://picsum.photos/seed/alex2/800/1000']
             },
             {
               id: 'dummy_sarah',
               displayName: 'Sarah K, 22',
               location: 'London, UK',
               photos: ['https://picsum.photos/seed/sarah1/800/1000']
             },
             {
               id: 'dummy_jordan',
               displayName: 'Jordan T, 26',
               location: 'New York, US',
               photos: ['https://picsum.photos/seed/jordan1/800/1000', 'https://picsum.photos/seed/jordan2/800/1000']
             },
             {
               id: 'dummy_emma',
               displayName: 'Emma L, 23',
               location: 'Toronto, CA',
               photos: ['https://picsum.photos/seed/emma1/800/1000', 'https://picsum.photos/seed/emma2/800/1000']
             },
             {
               id: 'dummy_liam',
               displayName: 'Liam P, 27',
               location: 'Berlin, DE',
               photos: ['https://picsum.photos/seed/liam1/800/1000']
             },
             {
               id: 'dummy_mia',
               displayName: 'Mia R, 21',
               location: 'Paris, FR',
               photos: ['https://picsum.photos/seed/mia1/800/1000', 'https://picsum.photos/seed/mia2/800/1000']
             },
             {
               id: 'dummy_noah',
               displayName: 'Noah J, 25',
               location: 'Tokyo, JP',
               photos: ['https://picsum.photos/seed/noah1/800/1000']
             },
             {
               id: 'dummy_olivia',
               displayName: 'Olivia S, 28',
               location: 'Austin, US',
               photos: ['https://picsum.photos/seed/olivia1/800/1000', 'https://picsum.photos/seed/olivia2/800/1000']
             }
           ];
           // Only show dummies that haven't been rated or blocked yet
           unratedProfiles = dummyProfiles.filter(d => !ratedIds.has(d.id) && !blockedIds.has(d.id));

           // If they have somehow rated absolutely every single dummy profile, 
           // loop them back in for demonstration purposes so the app never empties out.
           if (unratedProfiles.length === 0) {
             unratedProfiles = dummyProfiles;
           }
        }
        
        setProfiles(unratedProfiles);
      } catch (error) {
        console.error("Error fetching profiles", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfiles();
  }, []);

  const currentProfile = profiles[currentIndex];

  const handleSubmitRating = async () => {
    if (rating === 0 || !currentProfile || !auth.currentUser) return;
    setIsSubmitting(true);
    
    try {
      const uid = auth.currentUser.uid;

      // Save the rating to Firestore
      const ratingData: any = {
        raterId: uid,
        targetId: currentProfile.id,
        score: rating,
        createdAt: serverTimestamp()
      };
      if (comment.trim()) {
        ratingData.comment = comment.trim();
      }

      await addDoc(collection(db, 'ratings'), ratingData);

      // Increment user's reviews given count safely
      const userProfileRef = doc(db, 'publicProfiles', uid);
      try {
        await updateDoc(userProfileRef, {
          reviewsGivenCount: increment(1)
        });
      } catch (updateError: any) {
        // Fallback: If the user bypassed the setup screen and has no profile, create it now
        if (updateError.code === 'not-found') {
          await setDoc(userProfileRef, {
            uid,
            displayName: auth.currentUser.displayName || 'Anonymous',
            location: 'Global',
            photos: [auth.currentUser.photoURL || 'https://picsum.photos/seed/user/400/500'],
            reviewsGivenCount: 1,
            averageRating: 0,
            totalRatings: 0,
            ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
            createdAt: serverTimestamp()
          });
          await setDoc(doc(db, 'users', uid), {
            uid,
            email: auth.currentUser.email || '',
            role: 'user',
            createdAt: serverTimestamp()
          });
        } else {
          throw updateError;
        }
      }
      
      // Move to next profile
      setRating(0);
      setComment('');
      setCurrentIndex(prev => prev + 1);
    } catch (error: any) {
      console.error("Error submitting rating", error);
      alert(`Failed to submit rating: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setRating(0);
    setComment('');
    setCurrentIndex(prev => prev + 1);
  };

  const handleBlock = async () => {
    if (!currentProfile || !auth.currentUser) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'blocks'), {
        blockerId: auth.currentUser.uid,
        blockedId: currentProfile.id,
        createdAt: serverTimestamp()
      });
      handleSkip();
    } catch (error) {
      console.error("Error blocking user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen w-full max-w-[760px] mx-auto px-6 flex flex-col items-center justify-center pb-24 bg-[#0F0F11]">
        <p className="text-[#8A8894]">Finding profiles...</p>
        <BottomNavBar />
      </main>
    );
  }

  if (!currentProfile) {
    return (
      <main className="min-h-screen w-full max-w-[760px] mx-auto px-6 flex flex-col items-center justify-center pb-24 bg-[#0F0F11]">
        <h2 className="text-xl font-bold text-[#F0EEE8]">You're all caught up!</h2>
        <p className="text-[#8A8894] mt-2 mb-6">No more profiles to rate right now.</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-3 rounded-full bg-[#1C1C1E] border border-white/10 text-white font-medium hover:border-[#FF4D6D] transition-colors"
        >
          Refresh Feed
        </button>
        <BottomNavBar />
      </main>
    );
  }

  return (
    <main className="pt-24 px-6 w-full max-w-[760px] mx-auto flex flex-col gap-8 pb-32">
      {/* TopAppBar */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-[#131315]/80 backdrop-blur-md">
        <div className="flex justify-between items-center px-6 h-16 w-full max-w-[760px] mx-auto">
          <div className="flex flex-col">
            <span className="text-2xl font-black tracking-tighter text-[#FFB5E8]">Drate</span>
            <span className="text-[13px] text-[#8A8894] font-medium">Rate profiles to earn your report</span>
          </div>
          <div className="bg-[#1B1B1D] px-3 py-1.5 rounded-[10px] flex items-center">
            <span className="text-[14px] font-bold text-[#F5C842]">
              {(currentUserProfile?.reviewsGivenCount || 0) % 5} / 5 reviews
            </span>
          </div>
        </div>
      </nav>

      {/* Profile Card */}
      <section className="relative w-full h-[440px] rounded-[32px] overflow-hidden group shadow-2xl mt-4">
        <div className="absolute inset-0 bg-[#1C1C1E]">
          <img src={currentProfile.photos?.[0]} alt="Profile" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F11] via-[#0F0F11]/40 to-transparent"></div>
        
        <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
          <div className="space-y-1">
            <h2 className="text-[26px] font-black text-white tracking-tight drop-shadow-md">{currentProfile.displayName}</h2>
            <div className="flex gap-2">
              <span className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-white/90 text-[12px] font-medium border border-white/10 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                {currentProfile.location}
              </span>
              <span className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-white/90 text-[12px] font-medium border border-white/10 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="14" rx="2" ry="2"></rect><path d="M12 11v8"></path><path d="M16 15v.01"></path><path d="M8 15v.01"></path><path d="M12 4a4 4 0 0 1 4 4v4H8V8a4 4 0 0 1 4-4z"></path></svg>
                {currentProfile.photos?.length || 1} photos
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Title */}
      <h3 className="text-[20px] font-semibold text-[#F0EEE8] text-center mt-2">
        Great profile <span className="ml-1 text-xl">🔥</span>
      </h3>

      {/* Rating Section */}
      <section className="flex justify-center gap-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star 
            key={star}
            onClick={() => setRating(star)}
            className={`cursor-pointer transition-all ${rating >= star ? 'text-[#FF4D6D] drop-shadow-[0_0_15px_rgba(255,77,109,0.9)] scale-110' : 'text-[#2D2D30] hover:text-[#4A4A4D]'}`}
            size={42}
            fill={rating >= star ? 'currentColor' : 'none'}
            strokeWidth={1.5}
          />
        ))}
      </section>

      {/* Suggestions & Comment Input */}
      <section className="w-full flex flex-col gap-4 mt-2">
        <h4 className="text-[17px] font-medium text-[#F0EEE8]">What stood out?</h4>
        <div className="flex flex-wrap gap-2.5">
          {["Style", "Photography", "Vibe", "Details", "Lighting"].map(suggestion => {
             const isSelected = comment.includes(suggestion);
             return (
              <button
                key={suggestion}
                onClick={() => setComment(prev => isSelected ? prev.replace(new RegExp(`(?:, )?${suggestion}`), '').trim().replace(/^,/, '') : (prev ? `${prev}, ${suggestion}` : suggestion))}
                className={`px-4 py-2 rounded-full text-[14px] font-medium transition-all active:scale-95 ${isSelected ? 'bg-sunset-gradient text-white shadow-[0_0_12px_rgba(255,107,107,0.5)] border-transparent' : 'bg-[#1C1C1E] border border-white/10 text-[#8A8894] hover:border-white/20 hover:text-white'}`}
              >
                {suggestion}
              </button>
             );
          })}
        </div>
      </section>

      {/* Actions */}
      <button 
        onClick={handleSubmitRating}
        disabled={rating === 0 || isSubmitting}
        className={`w-full h-[60px] rounded-[24px] font-bold text-[18px] active:scale-[0.98] transition-all shadow-[0_8px_30px_rgba(255,77,109,0.3)] mt-4 mb-2 ${rating > 0 ? 'bg-coral-gradient text-white' : 'bg-[#1C1C1E] text-[#8A8894] shadow-none opacity-80'}`}
      >
        {isSubmitting ? 'Submitting...' : 'Submit Rating'}
      </button>

      <div className="relative flex justify-center items-center pb-8 w-full">
        <button 
          onClick={handleBlock}
          disabled={isSubmitting}
          className="absolute left-2 text-[#8A8894]/70 hover:text-[#FF4D6D] text-[13px] font-medium transition-colors flex items-center gap-1.5 active:scale-95"
        >
          <Ban size={14} /> Block
        </button>
        <button 
          onClick={handleSkip} 
          disabled={isSubmitting}
          className="text-[#8A8894] text-[15px] font-medium hover:text-[#F0EEE8] transition-colors active:scale-95"
        >
          Skip
        </button>
      </div>

      <BottomNavBar />
    </main>
  );
}
