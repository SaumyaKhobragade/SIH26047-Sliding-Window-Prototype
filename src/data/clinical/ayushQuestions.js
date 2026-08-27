/**
 * AYUSH / Ayurvedic Assessment Questionnaire Configuration
 * Configuration-driven model for Dashavidha Pariksha & Ahara-Vihara subset
 */

export const ayushQuestions = [
  {
    id: 'prakriti',
    title: 'Prakriti (Natural Constitution)',
    sanskritTerm: 'Prakriti Pariksha',
    question: 'How would you describe your natural body frame, temperature preference, and energy pattern?',
    hint: 'This reflects your baseline constitutional tendency when in normal health.',
    type: 'single',
    options: [
      {
        value: 'Vata',
        label: 'Vata Predominant',
        description: 'Slender frame, prefers warm weather, variable energy, quick to move and think.',
        icon: 'wind'
      },
      {
        value: 'Pitta',
        label: 'Pitta Predominant',
        description: 'Medium build, prefers cool environments, strong appetite, sharp intellect & focus.',
        icon: 'flame'
      },
      {
        value: 'Kapha',
        label: 'Kapha Predominant',
        description: 'Sturdy/broad frame, steady stamina, calm temperament, prefers active warmth.',
        icon: 'mountain'
      },
      {
        value: 'not_sure',
        label: 'Not Sure / Balanced',
        description: 'Mixed characteristics or unsure. The physician will evaluate during consultation.',
        icon: 'help-circle'
      }
    ]
  },
  {
    id: 'vikritiSymptoms',
    title: 'Vikriti (Current Symptoms / Imbalance Tendency)',
    sanskritTerm: 'Vikriti Pariksha',
    question: 'Which of the following symptoms or changes have you been experiencing recently?',
    hint: 'You can select multiple options if applicable.',
    type: 'multi',
    options: [
      {
        value: 'Digestive discomfort',
        label: 'Digestive discomfort / acidity / bloating',
        description: 'Heaviness, acid reflux, gas, or post-meal fullness',
        icon: 'activity'
      },
      {
        value: 'Fatigue',
        label: 'General fatigue or low vitality',
        description: 'Feeling sluggish, tired without heavy exertion',
        icon: 'battery-low'
      },
      {
        value: 'Irregular sleep',
        label: 'Disturbed or irregular sleep',
        description: 'Difficulty falling asleep, restless nights, or waking early',
        icon: 'moon'
      },
      {
        value: 'Skin changes',
        label: 'Excessive dryness or skin breakouts',
        description: 'Skin rash, unusual dry patches, or heat sensations',
        icon: 'sun'
      },
      {
        value: 'Appetite changes',
        label: 'Sudden change in appetite or taste',
        description: 'Loss of taste, insatiable hunger, or sweet/sour cravings',
        icon: 'utensils'
      },
      {
        value: 'None of these',
        label: 'None of the above',
        description: 'No significant recent constitutional complaints',
        icon: 'check'
      }
    ]
  },
  {
    id: 'agni',
    title: 'Agni (Digestive Strength)',
    sanskritTerm: 'Agni Pariksha',
    question: 'How would you describe your digestion and how comfortably your body digests food?',
    hint: 'Agni represents metabolic fire and digestive efficiency.',
    type: 'single',
    options: [
      {
        value: 'Slow',
        label: 'Slow / Heavy (Manda Agni)',
        description: 'Digestion takes long time; feeling heavy after meals even with light food.',
        icon: 'clock'
      },
      {
        value: 'Moderate',
        label: 'Balanced / Normal (Sama Agni)',
        description: 'Food digests smoothly in 3-4 hours with consistent natural appetite.',
        icon: 'check-circle'
      },
      {
        value: 'Strong',
        label: 'Intense / Rapid (Tikshna Agni)',
        description: 'Very quick digestion, frequent hunger, discomfort if meals are delayed.',
        icon: 'zap'
      },
      {
        value: 'Irregular',
        label: 'Variable / Fluctuating (Visham Agni)',
        description: 'Sometimes digests well, other times causes gas, bloating, or irregular appetite.',
        icon: 'shuffle'
      }
    ]
  },
  {
    id: 'koshtha',
    title: 'Koshtha (Bowel Pattern)',
    sanskritTerm: 'Koshtha Pariksha',
    question: 'How would you describe your usual bowel movement pattern?',
    hint: 'Reflects the nature of your alimentary canal.',
    type: 'single',
    options: [
      {
        value: 'Easy / regular',
        label: 'Easy & Regular (Madhya / Mridu Koshtha)',
        description: 'Smooth daily evacuation without straining or needing laxatives.',
        icon: 'smile'
      },
      {
        value: 'Sometimes irregular',
        label: 'Variable / Sensitive (Madhyama Koshtha)',
        description: 'Varies with diet, travel, or stress; occasionally requires dietary care.',
        icon: 'alert-triangle'
      },
      {
        value: 'Usually difficult',
        label: 'Hard / Constipation-Prone (Krura Koshtha)',
        description: 'Dry or hard stools, irregular schedule, requires extra fluids or fiber.',
        icon: 'shield-alert'
      }
    ]
  },
  {
    id: 'aharaShakti',
    title: 'Ahara Shakti (Food Intake & Appetite Capacity)',
    sanskritTerm: 'Ahara Shakti Pariksha',
    question: 'How would you describe your appetite and capacity to consume regular balanced meals?',
    hint: 'Evaluates your nutritional intake and digestive capacity.',
    type: 'single',
    options: [
      {
        value: 'Low',
        label: 'Low / Poor Capacity (Avara Shakti)',
        description: 'Small portion sizes satisfy hunger quickly; struggles with full meals.',
        icon: 'coffee'
      },
      {
        value: 'Moderate',
        label: 'Moderate Capacity (Madhyama Shakti)',
        description: 'Comfortable with standard portions; regular wholesome appetite.',
        icon: 'utensils'
      },
      {
        value: 'Good',
        label: 'Strong / Robust Capacity (Pravara Shakti)',
        description: 'Healthy appetite, can consume and assimilate nutritious hearty meals easily.',
        icon: 'heart'
      }
    ]
  },
  {
    id: 'vyayamaShakti',
    title: 'Vyayama Shakti (Physical Stamina & Exercise Tolerance)',
    sanskritTerm: 'Vyayama Shakti Pariksha',
    question: 'How would you describe your physical endurance and capacity for exercise or physical work?',
    hint: 'Evaluates muscular endurance, cardiovascular reserve, and vitality.',
    type: 'single',
    options: [
      {
        value: 'Low',
        label: 'Low Stamina (Avara Shakti)',
        description: 'Gets tired quickly with mild walking or climbing stairs.',
        icon: 'battery'
      },
      {
        value: 'Moderate',
        label: 'Moderate Stamina (Madhyama Shakti)',
        description: 'Tolerates routine physical work, 30 min brisk walk, or mild workouts comfortably.',
        icon: 'activity'
      },
      {
        value: 'High',
        label: 'High Stamina (Pravara Shakti)',
        description: 'High endurance, participates in sports, heavy physical exertion without undue fatigue.',
        icon: 'award'
      }
    ]
  },
  {
    id: 'aharaVihara',
    title: 'Ahara-Vihara (Diet, Sleep & Lifestyle Routine)',
    sanskritTerm: 'Ahara-Vihara Pariksha',
    question: 'Tell us briefly about your daily dietary habits, sleep quality, and activity level.',
    hint: 'Ahara (Diet) and Vihara (Lifestyle) are foundational pillars in Ayurvedic assessment.',
    type: 'lifestyle-group',
    subQuestions: [
      {
        id: 'diet',
        label: 'Dietary Preference (Ahara)',
        options: ['Vegetarian', 'Non-vegetarian', 'Mixed']
      },
      {
        id: 'sleep',
        label: 'Sleep Quality (Nidra)',
        options: ['Poor', 'Average', 'Good']
      },
      {
        id: 'activity',
        label: 'Daily Physical Activity (Vihara)',
        options: ['Mostly sitting', 'Moderately active', 'Highly active']
      }
    ]
  }
]

// Demo default responses for Rahul Sharma
export const demoAyushResponses = {
  prakriti: 'Pitta',
  vikritiSymptoms: ['Digestive discomfort'],
  agni: 'Irregular',
  koshtha: 'Sometimes irregular',
  aharaShakti: 'Moderate',
  vyayamaShakti: 'Moderate',
  aharaVihara: {
    diet: 'Mixed',
    sleep: 'Average',
    activity: 'Moderately active'
  }
}
