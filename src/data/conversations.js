export const conversationData = {
  chestPainScenario: [
    {
      id: 1,
      type: 'ai',
      message: 'What brings you here today?',
      timestamp: new Date(Date.now() - 5 * 60000),
    },
    {
      id: 2,
      type: 'patient',
      message: 'I have been having chest pain since yesterday.',
      timestamp: new Date(Date.now() - 4 * 60000),
    },
    {
      id: 3,
      type: 'ai',
      message: 'Can you describe the nature of the pain? Is it sharp, dull, or pressure-like?',
      timestamp: new Date(Date.now() - 3.5 * 60000),
    },
    {
      id: 4,
      type: 'patient',
      message: 'It feels like a pressure in my chest, especially when I move around.',
      timestamp: new Date(Date.now() - 3 * 60000),
    },
    {
      id: 5,
      type: 'ai',
      message: 'Do you experience any shortness of breath along with this pain?',
      timestamp: new Date(Date.now() - 2 * 60000),
    },
    {
      id: 6,
      type: 'patient',
      message: 'Yes, I do feel breathless when I walk or climb stairs.',
      timestamp: new Date(Date.now() - 1 * 60000),
    },
  ],
  nextAIQuestion: 'Have you experienced anything like this before? Do you have any medical history related to your heart or blood pressure?',
  quickResponses: [
    'Yes, frequently',
    'No, first time',
    'Occasionally',
    'Not sure'
  ],
}
