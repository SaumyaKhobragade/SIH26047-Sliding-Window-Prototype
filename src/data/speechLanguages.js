/**
 * Supported Languages and Speech Configuration
 * English, Hindi, and Marathi mapping with translations for common clinical interview prompts.
 */

export const speechLanguages = {
  en: {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    speechRecognition: 'en-IN',
    speechSynthesis: 'en-IN',
    voiceAssistantPrompt: 'Voice Assistance Active',
    listeningPrompt: 'Listening... Speak now',
    tapToSpeak: 'Tap to Speak',
    confirmTranscript: 'You said:',
    useThis: 'Use This Answer',
    tryAgain: 'Try Again',
    typeOrSpeak: 'Type or speak your response...',
    translations: {
      'What brings you here today?': 'What brings you here today?',
      'When did this problem start?': 'When did this problem start?',
      'Can you describe the character of the pain?': 'Can you describe the character of the pain?',
      'Does the pain spread or radiate to other areas?': 'Does the pain spread or radiate to other areas?',
      'On a scale of 1 to 10, how severe is the pain?': 'On a scale of 1 to 10, how severe is the pain?',
      'Are you experiencing any other symptoms?': 'Are you experiencing any other symptoms?',
      'Do you have any past medical conditions?': 'Do you have any past medical conditions?',
      'What medications are you currently taking?': 'What medications are you currently taking?',
      'Do you have any known drug or food allergies?': 'Do you have any known drug or food allergies?',
    },
  },
  hi: {
    code: 'hi',
    label: 'Hindi',
    nativeLabel: 'हिंदी',
    speechRecognition: 'hi-IN',
    speechSynthesis: 'hi-IN',
    voiceAssistantPrompt: 'वॉयस सहायता सक्रिय',
    listeningPrompt: 'सुन रहे हैं... अब बोलिए',
    tapToSpeak: 'बोलने के लिए दबाएं',
    confirmTranscript: 'आपने कहा:',
    useThis: 'यह उत्तर उपयोग करें',
    tryAgain: 'फिर से बोलें',
    typeOrSpeak: 'लिखें या बोलकर बताएं...',
    translations: {
      'What brings you here today?': 'आज आप किस तकलीफ के लिए आए हैं?',
      'When did this problem start?': 'यह समस्या कब शुरू हुई?',
      'Can you describe the character of the pain?': 'दर्द कैसा महसूस होता है?',
      'Does the pain spread or radiate to other areas?': 'क्या दर्द कंधे, बांह या पीठ की तरफ फैलता है?',
      'On a scale of 1 to 10, how severe is the pain?': '1 से 10 के पैमाने पर दर्द कितना तीव्र है?',
      'Are you experiencing any other symptoms?': 'क्या आपको सांस लेने में तकलीफ या पसीना आ रहा है?',
      'Do you have any past medical conditions?': 'क्या आपको पहले से कोई बीमारी जैसे बीपी या शुगर है?',
      'What medications are you currently taking?': 'आप वर्तमान में कौन सी दवाएं ले रहे हैं?',
      'Do you have any known drug or food allergies?': 'क्या आपको किसी दवा से एलर्जी है?',
    },
  },
  mr: {
    code: 'mr',
    label: 'Marathi',
    nativeLabel: 'मराठी',
    speechRecognition: 'mr-IN',
    speechSynthesis: 'mr-IN',
    voiceAssistantPrompt: 'व्हॉइस सहाय्य सक्रिय',
    listeningPrompt: 'ऐकत आहे... आता बोला',
    tapToSpeak: 'बोलण्यासाठी टॅप करा',
    confirmTranscript: 'तुम्ही म्हणालात:',
    useThis: 'हे उत्तर वापरा',
    tryAgain: 'पुन्हा बोला',
    typeOrSpeak: 'टाइप करा किंवा बोला...',
    translations: {
      'What brings you here today?': 'आज तुम्हाला काय त्रास होत आहे?',
      'When did this problem start?': 'हा त्रास कधी सुरू झाला?',
      'Can you describe the character of the pain?': 'वेदनेचे स्वरूप कसे आहे?',
      'Does the pain spread or radiate to other areas?': 'वेदना खांदा किंवा हाताकडे पसरते का?',
      'On a scale of 1 to 10, how severe is the pain?': '1 ते 10 च्या प्रमाणात वेदना किती तीव्र आहे?',
      'Are you experiencing any other symptoms?': 'तुम्हाला धाप लागणे किंवा घाम येणे असा काही त्रास होतोय का?',
      'Do you have any past medical conditions?': 'तुम्हाला रक्तदाब किंवा इतर जुनाट आजार आहे का?',
      'What medications are you currently taking?': 'तुम्ही सध्या कोणती औषधे घेत आहात?',
      'Do you have any known drug or food allergies?': 'तुम्हाला कोणत्याही औषधाची अ‍ॅलर्जी आहे का?',
    },
  },
}

// Fallback demo speech recognition responses for Rahul Sharma's interview questions
export const demoVoiceTranscripts = [
  {
    keywords: ['bring', 'today', 'why', 'complaint', 'takleef', 'tras'],
    transcript: "I have been having chest pain since yesterday.",
  },
  {
    keywords: ['when', 'start', 'begin', 'onset', 'duration', 'kab', 'kadhi'],
    transcript: "Yesterday evening after dinner.",
  },
  {
    keywords: ['character', 'feel', 'type', 'kaisa', 'kase'],
    transcript: "It feels like heavy pressure in the center of my chest.",
  },
  {
    keywords: ['spread', 'radiat', 'shoulder', 'arm', 'fail', 'pasarte'],
    transcript: "Yes, the pain radiates to my left shoulder and upper arm.",
  },
  {
    keywords: ['severe', 'scale', '10', 'rate', 'teevra'],
    transcript: "Around 7 out of 10.",
  },
  {
    keywords: ['other', 'symptom', 'breath', 'sweat', 'saans', 'dhap'],
    transcript: "Yes, I feel shortness of breath and mild sweating on exertion.",
  },
  {
    keywords: ['past', 'history', 'condition', 'pehle', 'junat'],
    transcript: "I have high blood pressure for the last 5 years. No diabetes.",
  },
  {
    keywords: ['medication', 'taking', 'medicine', 'dawa', 'aushadh'],
    transcript: "I take Tab Amlodipine 5 mg once daily in the morning.",
  },
  {
    keywords: ['allerg', 'allergen', 'reaction'],
    transcript: "I am allergic to Penicillin. It caused a rash previously.",
  },
  {
    keywords: ['agni', 'digest', 'pachan'],
    transcript: "My digestion is irregular.",
  },
  {
    keywords: ['koshtha', 'bowel', 'pot'],
    transcript: "My bowel movements are sometimes irregular.",
  },
  {
    keywords: ['prakriti', 'body', 'frame', 'energy'],
    transcript: "Pitta predominant.",
  },
]
