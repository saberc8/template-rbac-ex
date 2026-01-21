import Base64 from 'crypto-js/enc-base64'
import UTF8 from 'crypto-js/enc-utf8'
import md5 from 'crypto-js/md5'
import CryptoJS from 'crypto-js'

export function encodeByBase64(txt: string) {
  return UTF8.parse(txt).toString(Base64)
}

export function decodeByBase64(txt: string) {
  return Base64.parse(txt).toString(UTF8)
}

export function encryptByMd5(txt: string) {
  return md5(txt).toString()
}

export function encryptByRsa(txt: string) {
  return txt
}

const defaultKeyWork = 'XwKsGlMcdPMEhR1B'

export function encryptByAes(word, keyWord = defaultKeyWork) {
  const key = CryptoJS.enc.Utf8.parse(keyWord)
  const arcs = CryptoJS.enc.Utf8.parse(word)
  const encrypted = CryptoJS.AES.encrypt(arcs, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  })
  return encrypted.toString()
}
