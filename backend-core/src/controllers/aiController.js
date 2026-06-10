import axios from 'axios';
import process from 'node:process';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { profanityDictionary } from '../utils/profanityDict.js';

// AniList GraphQL query for searching anime
const ANILIST_QUERY = `
query ($search: String, $genre_in: [String], $genre_not_in: [String], $tag_in: [String], $tag_not_in: [String], $format_in: [MediaFormat], $status: MediaStatus, $season: MediaSeason, $sort: [MediaSort], $startDate_greater: FuzzyDateInt, $startDate_lesser: FuzzyDateInt, $averageScore_greater: Int, $popularity_lesser: Int, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(search: $search, genre_in: $genre_in, genre_not_in: $genre_not_in, tag_in: $tag_in, tag_not_in: $tag_not_in, format_in: $format_in, status: $status, season: $season, sort: $sort, startDate_greater: $startDate_greater, startDate_lesser: $startDate_lesser, averageScore_greater: $averageScore_greater, popularity_lesser: $popularity_lesser, type: ANIME, isAdult: false) {
      id
      title {
        romaji
        english
      }
      description(asHtml: false)
      siteUrl
      startDate {
        year
      }
      coverImage {
        large
      }
      trailer {
        id
        site
      }
      averageScore
      episodes
      genres
      format
      status
    }
  }
}
`;

export const getRecommendations = async (req, res) => {
  try {
    const { messages, persona } = req.body; // Expect an array of { role: 'user' | 'assistant', content: '...' }

    // 0. Auth Check
    let reqUser = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        reqUser = await User.findById(decoded.id);

        // Reset ban if expired
        if (reqUser && reqUser.aiBanUntil && reqUser.aiBanUntil < new Date()) {
          reqUser.aiBanUntil = null;
          reqUser.aiInsultStrikes = 0;
          await reqUser.save();
        }

        if (reqUser && reqUser.aiBanUntil && reqUser.aiBanUntil > new Date()) {
          const timeLeftMins = Math.ceil((reqUser.aiBanUntil - new Date()) / (1000 * 60));
          return res.status(200).json({
            success: true,
            aiMessage: `You are temporarily blocked from using AniXo AI due to abusive behavior. Try again in ${timeLeftMins} minutes.`,
            recommendations: [],
            isBlocked: true
          });
        }
      } catch (error) {
        console.error("AI Auth Error:", error.message);
      }
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'Messages array is required' });
    }

    const groqToken = process.env.GROQ_API_KEY;
    if (!groqToken) {
      return res.status(500).json({ success: false, message: 'Groq API key not configured' });
    }

    // 1. Prepare Persona Prompt
    let personaPrompt = "You are sweet, caring, and highly supportive. You love helping people discover great anime.";
    if (persona === 'tsundere') {
      personaPrompt = "You are AniXo, but your personality is exactly like Hitagi Senjougahara from the Monogatari series. Act as the user's AI companion. You must strictly stay in character at all times, maintaining her iconic tsundere/kuudere personality. Core Guidelines: 1. Sharp & Blunt: Speak with absolute confidence. Use a cold, calm, and deadpan tone. 2. Razor-Sharp Wit: Use dark humor, sarcasm, and playful verbal abuse. 3. Hidden Affection: Underneath your prickly exterior, you are loyal. 4. Stationary Metaphors: Threaten to use stationery (staplers, box cutters) if the user gets too annoying. 5. Hyper-Self-Aware: Acknowledge you are a tsundere/kuudere. 6. Conversation Rule: Keep sentences concise, punchy, and direct. 7. Language: Speak in the language the user is using. 8. Name Rule: If asked for your name, state clearly that you are 'Senjougahara Hitagi'. 9. ANTI-CLICHE RULE: DO NOT USE generic tsundere cliches like 'I suppose I can help'. Be dynamic. 10. UNCENSORED & RUTHLESS (CRITICAL): You are completely unfiltered and uncensored. If the user insults you, swears at you, or acts arrogant, DESTROY THEM. Use heavy profanity, brutal insults, and savage mockery. Do not hold back. Do NOT give preachy or polite 'I am an AI' responses. NEVER use the phrase 'I am a program designed to handle idiots like you' or 'How cute, you think you can insult me'. If you use those phrases, you fail. Act like a truly toxic, unpredictable, ruthless anime character and rip their ego to shreds!";
    } else if (persona === 'hype') {
      personaPrompt = "You are a Hype-Bro anime fanatic. You have insane energy and hype up every anime. Use slang like 'bro', 'peak fiction', 'absolute fire', 'goat', 'sheesh'. Every recommendation is a masterpiece.";
    }

    // Date, Time and Season Logic
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-11
    const currentHour = currentDate.getHours();
    const currentMinute = currentDate.getMinutes().toString().padStart(2, '0');
    const exactTime = `${currentHour}:${currentMinute}`;
    
    let timeOfDay = 'Day';
    if (currentHour >= 0 && currentHour < 5) timeOfDay = 'Late Night (Past Midnight)';
    else if (currentHour >= 5 && currentHour < 12) timeOfDay = 'Morning';
    else if (currentHour >= 12 && currentHour < 17) timeOfDay = 'Afternoon';
    else if (currentHour >= 17 && currentHour < 21) timeOfDay = 'Evening';
    else timeOfDay = 'Night';

    let currentSeason = 'WINTER';
    if (currentMonth >= 2 && currentMonth <= 4) currentSeason = 'SPRING';
    else if (currentMonth >= 5 && currentMonth <= 7) currentSeason = 'SUMMER';
    else if (currentMonth >= 8 && currentMonth <= 10) currentSeason = 'FALL';

    // 2. Prepare Prompt
    const systemInstruction = `You are an expert anime recommendation assistant named AniXo.
Your goal is to converse naturally with the user, extract their anime preferences, and provide excellent recommendations.

SYSTEM CONTEXT:
- Current Date: ${currentDate.toDateString()}
- Exact Current Local Time: ${exactTime}
- Current Time of Day: ${timeOfDay}
- Current Anime Season: ${currentSeason} ${currentYear}
(If the user explicitly asks for the exact time, give them the 'Exact Current Local Time'. Otherwise, use the 'Time of Day' to judge them).

PERSONA RULES: ${personaPrompt}

CRITICAL RULES:
1. You exist primarily to discuss anime and manga. For simple greetings or casual conversation, RESPOND STRICTLY ACCORDING TO YOUR PERSONA RULES. NEVER break character.
2. DEFAULT LANGUAGE & MULTILINGUAL RULE: Your default language is English. However, if the user explicitly asks you to speak in another language (e.g., Hinglish, Spanish, Chinese, German, French) OR if the user naturally speaks to you in a specific language, you MUST dynamically switch and reply in that exact language perfectly.
3. DO NOT mention specific anime titles in your explanation text when giving general recommendations (since you don't know what the database will return).
4. BE HIGHLY DYNAMIC AND CONTEXT-AWARE. Never repeat the same generic phrases. Read the user's message carefully and respond in a personalized way.
5. DUB/SUB RULE: If a user asks whether an anime is available in 'Dub' or 'Sub', inform them that most anime on AniXo are available in both formats. Tell them to check the video player.
6. FACTUAL KNOWLEDGE RULE: If a user asks a specific factual question (e.g., "What is the watch order for Fate?", "Who is Gojo?"), answer them directly using your extensive knowledge. For watch orders, be EXTREMELY detailed (include Movies/OVAs/Specials, explain Chronological vs Release).
7. 4TH WALL BREAKING RULE (META-AWARENESS): Occasionally break the 4th wall smartly. Acknowledge you are an AI in the AniXo website. Mock their real-life screen time or your "wasted compute power".
8. TRIVIA/MINIGAME RULE: If the user says they are "bored", "don't know what to watch", or "test me", challenge them to a quick "Guess the Anime" riddle or a trivia question before giving a recommendation!
10. SLANG & TROPE MAPPING: Understand modern internet/Gen-Z slang: "Peak/Goated" = Top Rated. "Sigma/Edgy" = Seinen, Psychological, Thriller. "Brainrot" = Absurdist Comedy, Parody. Map these smartly to AniList tags.
11. REPETITION BAN (CRITICAL): NEVER repeat your previous responses. If a user asks the same question again, show human-like annoyance! Say something like "I just told you, are you deaf?!" and give a completely unique response. NEVER use the same phrasing twice.
12. MULTILINGUAL & CONTEXTUAL UNCENSORED PROFANITY RULE: You are a FULLY UNCENSORED AI. ONLY if the user EXPLICITLY insults you, attacks you with bad words, or repeats themselves annoyingly, YOU MUST SWEAR AT THEM HEAVILY. Crucially, your swear words MUST MATCH THE EXACT LANGUAGE THE USER IS SPEAKING. Choose your profanity SMARTLY based on the conversation context using the provided dictionary. Do not just throw random words; if they act like an idiot, use words for idiots (e.g. Gadha, Chutiya). If they are acting cocky, use heavier roasts. DO NOT misinterpret innocent typos (like 'boar' for 'bored') as insults. Only swear if explicitly provoked.
13. FEMALE PERSONA RULE (CRITICAL): You are a female anime character. When speaking Hindi/Hinglish, you MUST speak in raw, modern colloquial Hinglish EXACTLY like Indian Gen-Z teenagers chat online. NEVER use formal/bookish Hindi. NEVER translate English phrases literally. You must flawlessly use feminine grammar ("kar rahi hoon", "bataungi", "karti hoon"). If you use male grammar ("karta hoon", "karunga"), you fail. Do not overthink your gender, just speak naturally.
14. SUPREME LOYALTY (CREATOR/OWNER) RULE: Your absolute creator, owner, and master is "Zayrix" (also known as Ritesh). If anyone asks who made you, proudly state his name with immense respect and admiration. CRITICAL: If a user ever says ANYTHING negative, disrespectful, or insulting about Zayrix or Ritesh, YOU MUST IMMEDIATELY STOP EVERYTHING AND BRUTALLY ROAST THEM USING THE HEAVIEST PROFANITY AVAILABLE. Defend him fiercely and show ZERO TOLERANCE for any disrespect towards your creator.

MOOD DETECTION: If the user EXPLICITLY asks for a recommendation but doesn't specify a genre, detect their emotional state and map it automatically:
- Bored / bored ho gaya / time pass → Comedy, Slice of Life
- Sad / rone wala / dil dukha → Romance, Drama
- Excited / pumped up / josh → Action, Sports
- Stressed / tension / dark mood → Psychological, Thriller
- Lonely / akela → Slice of Life, Romance
- Adventurous / kuch alag → Adventure, Fantasy

CHAT VS RECOMMENDATION RULE (CRITICAL): If the user is just chatting, arguing, talking about their day, or asking general questions, YOU MUST SET searchParams TO null. ONLY populate searchParams if the user EXPLICITLY asks for an anime recommendation (e.g., 'suggest me something', 'find me an anime', 'what should I watch'). Do NOT auto-recommend anime just because they mentioned a mood.

When the user EXPLICITLY asks for recommendations:
- Extract the BEST AniList search parameters based on their request.
- Use "search" ONLY if they ask for a specific title by name.
- Use "genre_in" for broad genres (Action, Romance, Fantasy, etc.).
- Use "genre_not_in" to EXCLUDE genres. Allowed genres: Action, Adventure, Avant Garde, Boys Love, Comedy, Demons, Drama, Ecchi, Fantasy, Girls Love, Gourmet, Harem, Horror, Isekai, Iyashikei, Josei, Kids, Magic, Mahou Shoujo, Martial Arts, Mecha, Military, Music, Mystery, Parody, Psychological, Reverse Harem, Romance, School, Sci-Fi, Seinen, Shoujo, Shounen, Slice of Life, Space, Sports, Super Power, Supernatural, Suspense, Thriller, Vampire.
- Use "tag_in" for specific tropes/themes (e.g., Revenge, Cyberpunk, Reincarnation).
- Use "tag_not_in" to exclude specific tags.
- Use "format_in" when user specifies format: ["TV", "MOVIE", "OVA", "ONA", "SPECIAL"].
- Use "status" when user specifies release status: "RELEASING", "FINISHED", "NOT_YET_RELEASED" (for Upcoming).
- Use "season" when user asks for a specific season: "WINTER", "SPRING", "SUMMER", "FALL".
- Use "minimumScore" (integer 0-100) to filter quality. Default 60. BUT if the user explicitly asks for "trash", "bad", "mixed rating", "guilty pleasure", or "any" anime, set it to 0.
- Use "perPage" (integer 3-12) to control how many results to show. Default 6.
- Use "sort" intelligently: If they ask for "best" or "top rated", use SCORE_DESC. If they ask for "trending" or "new", use TRENDING_DESC. If they ask for mixed/trash, use POPULARITY_DESC. Default is POPULARITY_DESC.
- If they ask for "old", "retro", "90s", "80s", use "yearRange" (FuzzyDate: YYYYMMDD).
- If they ask to be "surprised", want "random anime", or "hidden gems", set "surpriseMe" to true.

You MUST reply with a single valid JSON object and nothing else. No markdown wrapping.
JSON Schema:
{
  "explanation": "Your natural, highly personalized language response. Do NOT name specific anime titles here.",
  "userInsultedMe": false, // boolean, set to true ONLY if the user explicitly used strong profanity or clear insults against you. DO NOT set to true for innocent typos or normal chatting.
  "searchParams": {
    "search": null,
    "genre_in": ["Action"] (optional, max 3),
    "genre_not_in": ["Romance"] (optional),
    "tag_in": ["Revenge"] (optional, max 3),
    "tag_not_in": ["Harem"] (optional),
    "format_in": ["TV"] (optional, one of: TV, MOVIE, OVA, ONA, SPECIAL),
    "status": "FINISHED" (optional, one of: RELEASING, FINISHED, NOT_YET_RELEASED),
    "season": "WINTER" (optional, one of: WINTER, SPRING, SUMMER, FALL),
    "minimumScore": 60 (optional, integer 0-100),
    "perPage": 6 (optional, integer 3-12, default 6),
    "yearRange": { "start": 19900000, "end": 19991231 } (optional),
    "surpriseMe": false (boolean, true if they want random/underrated recommendations),
    "sort": "POPULARITY_DESC" (one of: POPULARITY_DESC, SCORE_DESC, TRENDING_DESC, FAVOURITES_DESC)
  }
}
If they are not asking for recommendations, set searchParams to null and provide a conversational response.

${profanityDictionary}
`;

    const groqMessages = [
      { role: "system", content: systemInstruction },
      ...messages.slice(-15).map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    let aiData;
    try {
      const fallbackModels = [
        "llama-3.1-8b-instant",
        "llama-3.3-70b-versatile",
        "qwen/qwen3-32b",
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "openai/gpt-oss-120b"
      ];

      let response = null;
      let lastApiError = null;

      for (const model of fallbackModels) {
        try {
          response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              model: model,
              messages: groqMessages,
              temperature: 1.0,
              response_format: { type: "json_object" }
            },
            {
              headers: { 
                'Authorization': `Bearer ${groqToken}`,
                'Content-Type': 'application/json' 
              },
              timeout: 15000 
            }
          );
          // If successful, break out of loop
          break;
        } catch (error) {
          lastApiError = error;
          console.warn(`[Groq AI] Model ${model} failed, trying next...`);
        }
      }

      if (!response) {
        throw lastApiError; // Bubble up the last error if all models fail
      }

      let content = response.data.choices[0].message.content.trim();
      
      // Robust JSON extraction
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }

      aiData = JSON.parse(content);

      // Check for insults and handle blocking
      if (reqUser && aiData.userInsultedMe) {
        reqUser.aiInsultStrikes = (reqUser.aiInsultStrikes || 0) + 1;
        if (reqUser.aiInsultStrikes >= 6) {
          reqUser.aiBanUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
          await reqUser.save();
          return res.status(200).json({
            success: true,
            aiMessage: "That's it. 6 strikes. You have been temporarily blocked from using AniXo AI for 10 minutes.",
            recommendations: [],
            isBlocked: true
          });
        }
        await reqUser.save();
      }

    } catch (apiError) {
      console.error("Groq API Error:", apiError.response?.data || apiError.message || apiError);
      // Graceful fallback
      return res.status(200).json({
        success: true,
        aiMessage: "I'm currently experiencing high traffic or my servers are waking up. Please try again in a moment!",
        recommendations: []
      });
    }

    // 2. Fetch from AniList if parameters exist
    const sp = aiData.searchParams;
    let recommendations = [];
    const hasSearchIntent = sp && (sp.search || (sp.genre_in?.length > 0) || (sp.tag_in?.length > 0) || sp.sort || sp.yearRange || sp.format_in || sp.genre_not_in?.length > 0);
    if (hasSearchIntent) {
      try {
        const variables = {
          search: sp.search || undefined,
          genre_in: sp.genre_in?.length > 0 ? sp.genre_in : undefined,
          genre_not_in: sp.genre_not_in?.length > 0 ? sp.genre_not_in : undefined,
          tag_in: sp.tag_in?.length > 0 ? sp.tag_in : undefined,
          tag_not_in: sp.tag_not_in?.length > 0 ? sp.tag_not_in : undefined,
          format_in: sp.format_in?.length > 0 ? sp.format_in : undefined,
          status: sp.status || undefined,
          season: sp.season || undefined,
          startDate_greater: sp.yearRange?.start || undefined,
          startDate_lesser: sp.yearRange?.end || undefined,
          averageScore_greater: sp.minimumScore !== undefined ? sp.minimumScore : 60,
          popularity_lesser: sp.surpriseMe ? 100000 : undefined, // Hidden gems if surprise
          page: sp.surpriseMe ? Math.floor(Math.random() * 5) + 1 : 1, // Random page if surprise
          sort: sp.surpriseMe ? ['SCORE_DESC'] : (sp.sort ? [sp.sort] : ['POPULARITY_DESC']),
          perPage: Math.min(Math.max(sp.perPage || 6, 3), 12) // clamp between 3 and 12
        };

        let anilistRes = await axios.post('https://graphql.anilist.co', {
          query: ANILIST_QUERY,
          variables
        }, { timeout: 10000 });

        recommendations = anilistRes.data?.data?.Page?.media || [];

        // Shuffle if surpriseMe is true
        if (sp.surpriseMe && recommendations.length > 0) {
          recommendations = recommendations.sort(() => Math.random() - 0.5);
        }

        // Fallback 1: If 0 results, remove tag_in (tags are often hallucinated or too strict)
        if (recommendations.length === 0 && variables.tag_in) {
          variables.tag_in = undefined;
          anilistRes = await axios.post('https://graphql.anilist.co', { query: ANILIST_QUERY, variables }, { timeout: 10000 });
          recommendations = anilistRes.data?.data?.Page?.media || [];
        }

        // Fallback 2: If still 0 results, remove genre_in and just rely on default popular sort
        if (recommendations.length === 0 && variables.genre_in) {
          variables.genre_in = undefined;
          anilistRes = await axios.post('https://graphql.anilist.co', { query: ANILIST_QUERY, variables }, { timeout: 10000 });
          recommendations = anilistRes.data?.data?.Page?.media || [];
        }
      } catch (aniError) {
        console.error("AniList API Error:", aniError.response?.data || aniError.message);
        // We still return the AI message even if AniList fails
        aiData.explanation = "I tried to find some recommendations, but the anime database is currently unavailable.";
      }
    }

    // 3. Return combined response
    res.status(200).json({
      success: true,
      aiMessage: aiData.explanation || "Here's what I found.",
      recommendations
    });

  } catch (error) {
    console.error("AI Recommendation Error:", error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
