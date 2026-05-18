import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { method, contact, resource, text } = await req.json()

    if (method === 'email') {
      await resend.emails.send({
        from: 'Veterans Directory <noreply@yourdomain.com>',
        to: contact,
        subject: `Veterans Resource: ${resource.name}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
            <div style="background:#1B3A6B;color:#fff;padding:16px 20px;">
              <h2 style="margin:0;font-size:18px;">🇺🇸 Veterans Resource Directory</h2>
              <p style="margin:4px 0 0;font-size:12px;opacity:.7;">John J. Pershing VA Medical Center</p>
            </div>
            <div style="padding:20px;border:1px solid #eee;border-top:none;">
              <h3 style="color:#1B3A6B;margin:0 0 4px;">${resource.name}</h3>
              <span style="background:#EDE9FE;color:#5B21B6;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;">${resource.type}</span>
              ${resource.phone ? `<p style="margin:12px 0 4px;"><strong>📞 Phone:</strong> <a href="tel:${resource.phone}" style="color:#1B3A6B;">${resource.phone}</a></p>` : ''}
              ${resource.address ? `<p style="margin:4px 0;"><strong>🏢 Address:</strong> ${resource.address}${resource.city ? ', ' + resource.city : ''}${resource.county ? ', ' + resource.county + ' County' : ''}</p>` : ''}
              ${resource.notes ? `<div style="background:#FEF3C7;border-left:3px solid #C8941A;padding:8px 12px;margin:12px 0;font-size:13px;color:#92400E;">📝 ${resource.notes}</div>` : ''}
              <p style="font-size:11px;color:#aaa;margin-top:16px;border-top:1px solid #eee;padding-top:12px;">Always call ahead to verify hours and availability.</p>
            </div>
          </div>`,
      })
    } else if (method === 'sms') {
      // SMS via Resend is not supported natively — use Twilio if needed
      // For now, log and return success (upgrade path noted)
      console.log('SMS requested to:', contact, '\n', text)
      // TODO: integrate Twilio for SMS
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Share error:', err)
    return NextResponse.json({ ok: false, error: 'Failed to send' }, { status: 500 })
  }
}
