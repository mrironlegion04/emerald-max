'use client'

export default function PrintButton() {
  const handlePrint = () => {
    window.print()
  }

  return (
    <button
      onClick={handlePrint}
      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg"
    >
      Print Work Order
    </button>
  )
}
