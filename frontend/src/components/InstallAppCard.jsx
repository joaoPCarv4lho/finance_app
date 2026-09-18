import { useState } from 'react'
import { Smartphone, Download, Share } from 'lucide-react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import Modal from './Modal.jsx'

export default function InstallAppCard() {
  const { canInstall, isIOS, promptInstall } = useInstallPrompt()
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  if (!canInstall && !isIOS) return null

  return (
    <div className="card mt-16">
      <h2 className="card-title">
        <Smartphone size={18} /> Instalar app
      </h2>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Acesse mais rápido, direto da tela inicial do seu celular.
      </p>
      <button
        className="btn mt-16"
        onClick={canInstall ? promptInstall : () => setShowIOSInstructions(true)}
      >
        <Download size={17} /> Instalar no celular
      </button>

      {showIOSInstructions && (
        <Modal
          title="Instalar no iPhone/iPad"
          onClose={() => setShowIOSInstructions(false)}
        >
          <p>Para instalar o Meu Bolso na tela inicial:</p>
          <ol>
            <li>
              Toque no ícone de Compartilhar{' '}
              <Share size={15} style={{ verticalAlign: 'middle' }} /> na barra
              do Safari.
            </li>
            <li>Escolha "Adicionar à Tela de Início".</li>
          </ol>
        </Modal>
      )}
    </div>
  )
}
