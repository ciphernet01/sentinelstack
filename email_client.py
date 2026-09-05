import resend

resend.api_key = "re_4fGt3hSv_F9C4nHsYZ3QDsyr8Ea4i7ppQ"

r = resend.Emails.send({
  "from": "onboarding@resend.dev",
  "to": "ss9415767850@gmail.com",
  "subject": "Hello World",
  "html": "<p>Congrats on sending your <strong>first email</strong>!</p>"
})
