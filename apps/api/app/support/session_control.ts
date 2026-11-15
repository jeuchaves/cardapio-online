import app from '@adonisjs/core/services/app'
import { SessionCollection } from '@adonisjs/session'
import type { HttpContext } from '@adonisjs/core/http'
import type User from '#models/user'

// ADR 0002 (adendo): o guard não preserva a etiqueta do usuário nem apaga login_at.

/** Login: o guard regenera o identificador; depois grava login_at e etiqueta a sessão. */
export async function startSession(ctx: HttpContext, user: User) {
  await ctx.auth.use('web').login(user)
  ctx.session.put('login_at', Date.now())
  await ctx.session.tag(String(user.id))
}

/** Rotaciona o identificador preservando login_at; regenerate() perde a etiqueta, então reaplica. */
export async function rotateSession(ctx: HttpContext, user: User) {
  ctx.session.regenerate()
  await ctx.session.tag(String(user.id))
}

/** Logout: esvazia a sessão (identidade, login_at e etiqueta) para a linha ser apagada no commit. */
export async function endCurrentSession(ctx: HttpContext) {
  const user = ctx.auth.user
  await ctx.auth.use('web').logout()
  ctx.session.forget('login_at')
  if (user) await ctx.session.untag(String(user.id))
}

/** Destrói todas as sessões etiquetadas com o usuário (reset de senha, desativação, troca de senha). */
export async function revokeUserSessions(userId: string) {
  const collection = await app.container.make(SessionCollection)
  for (const session of await collection.tagged(String(userId))) {
    await collection.destroy(session.id)
  }
}
