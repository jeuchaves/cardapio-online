import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { defineConfig, services } from '@adonisjs/drive'

// ADR 0003: disco local em dev e testes. O S3 de produção entra aqui como outro serviço
// (ver adendo do ADR); as imagens são servidas pela rota própria de /uploads, não pelo drive.
const driveConfig = defineConfig({
  default: 'fs',
  services: {
    fs: services.fs({
      location: app.makePath(env.get('UPLOADS_ROOT', 'storage')),
      serveFiles: false,
      visibility: 'public',
    }),
  },
})

export default driveConfig

declare module '@adonisjs/drive/types' {
  export interface DriveDisks extends InferDriveDisks<typeof driveConfig> {}
}
