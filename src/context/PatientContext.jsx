import React, { createContext, useState, useCallback } from 'react'
import { createEmptyHistory } from '../data/clinicalSchema'

export const PatientContext = createContext()

export function PatientProvider({ children }) {
  const [patientHistory, setPatientHistory] = useState(() => {
    const stored = sessionStorage.getItem('patientHistory')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return createEmptyHistory()
      }
    }
    return createEmptyHistory()
  })

  const updatePatientHistory = useCallback((path, value) => {
    setPatientHistory((prev) => {
      const updated = JSON.parse(JSON.stringify(prev))
      const keys = path.split('.')
      let current = updated

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {}
        }
        current = current[keys[i]]
      }

      current[keys[keys.length - 1]] = value
      sessionStorage.setItem('patientHistory', JSON.stringify(updated))
      return updated
    })
  }, [])

  const addToHistory = useCallback((path, value) => {
    setPatientHistory((prev) => {
      const updated = JSON.parse(JSON.stringify(prev))
      const keys = path.split('.')
      let current = updated

      for (let i = 0; i < keys.length; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = []
        }
        current = current[keys[i]]
      }

      if (Array.isArray(current)) {
        current.push(value)
      }

      sessionStorage.setItem('patientHistory', JSON.stringify(updated))
      return updated
    })
  }, [])

  const getPatientData = useCallback((path) => {
    const keys = path.split('.')
    let current = patientHistory

    for (let key of keys) {
      current = current[key]
      if (current === undefined) return undefined
    }

    return current
  }, [patientHistory])

  const resetPatientHistory = useCallback(() => {
    const empty = createEmptyHistory()
    setPatientHistory(empty)
    sessionStorage.removeItem('patientHistory')
  }, [])

  const value = {
    patientHistory,
    setPatientHistory,
    updatePatientHistory,
    addToHistory,
    getPatientData,
    resetPatientHistory,
  }

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>
}

export function usePatient() {
  const context = React.useContext(PatientContext)
  if (!context) {
    throw new Error('usePatient must be used within PatientProvider')
  }
  return context
}
