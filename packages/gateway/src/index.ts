import { Gateway } from '@sker/mq'

export async function bootstrap(port: number) {
    const gateway = new Gateway()
    await gateway.start(port)
}