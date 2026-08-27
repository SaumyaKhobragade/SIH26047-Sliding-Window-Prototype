export const ayushData = {
  assessmentParameters: [
    {
      id: 'prakrti',
      label: 'Prakriti (Constitution)',
      description: 'Your natural body type and temperament',
      options: [
        { value: 'vata', label: 'Vata (Airy)', description: 'Light, quick, active' },
        { value: 'pitta', label: 'Pitta (Fiery)', description: 'Sharp, intense, warm' },
        { value: 'kapha', label: 'Kapha (Earthy)', description: 'Heavy, stable, calm' }
      ],
      selected: 'pitta'
    },
    {
      id: 'agni',
      label: 'Agni (Digestive Fire)',
      description: 'Your digestive strength',
      options: [
        { value: 'mand', label: 'Mand Agni', description: 'Weak, slow digestion' },
        { value: 'sama', label: 'Sama Agni', description: 'Balanced digestion' },
        { value: 'tikshna', label: 'Tikshna Agni', description: 'Strong, fast digestion' }
      ],
      selected: 'sama'
    },
    {
      id: 'koshtha',
      label: 'Koshtha (Bowel Habit)',
      description: 'Your natural bowel movement pattern',
      options: [
        { value: 'krur', label: 'Krur Koshtha', description: 'Irregular, constipation-prone' },
        { value: 'madhya', label: 'Madhya Koshtha', description: 'Regular, normal' },
        { value: 'mrudu', label: 'Mrudu Koshtha', description: 'Loose, laxity-prone' }
      ],
      selected: 'madhya'
    },
    {
      id: 'ahara_shakti',
      label: 'Ahara Shakti (Appetite)',
      description: 'Your appetite level',
      options: [
        { value: 'weak', label: 'Weak', description: 'Poor appetite' },
        { value: 'moderate', label: 'Moderate', description: 'Average appetite' },
        { value: 'strong', label: 'Strong', description: 'Good appetite' }
      ],
      selected: 'strong'
    },
    {
      id: 'vyayama_shakti',
      label: 'Vyayama Shakti (Exercise Tolerance)',
      description: 'Your capacity for physical activity',
      options: [
        { value: 'low', label: 'Low', description: 'Tires easily' },
        { value: 'moderate', label: 'Moderate', description: 'Moderate capacity' },
        { value: 'high', label: 'High', description: 'Good stamina' }
      ],
      selected: 'moderate'
    }
  ]
}
