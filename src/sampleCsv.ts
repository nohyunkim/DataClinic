export const SAMPLE_FILE_NAME = 'dataclinic_sample.csv'

export const SAMPLE_CSV = `상품,분류,판매수량,지역
노트,문구,12,서울
펜,문구,8,부산
컵,생활,5,
노트,문구,12,서울
가방,패션,,대전
의자,가구,3,광주
`

export function createSampleFile(): File {
  return new File([SAMPLE_CSV], SAMPLE_FILE_NAME, { type: 'text/csv' })
}
