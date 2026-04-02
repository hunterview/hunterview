'use client';

// 쿠팡 파트너스 상품 목록 (실제 링크로 교체 필요)
// 형식: https://coupa.ng/[파트너스코드]
const COUPANG_ADS = [
  {
    name: '닥터지 레드 블레미쉬 클리어 수딩 크림 70ml',
    price: '18,900원',
    image: 'https://thumbnail6.coupangcdn.com/thumbnails/remote/230x230ex/image/retail/images/2023/02/10/10/9/b77c5f8f-1a2e-4e7e-a6d4-e1f87a6c2e6f.jpg',
    link: 'https://coupa.ng/ckmfRV',
  },
  {
    name: '롬앤 쥬시 래스팅 틴트 45종',
    price: '9,900원',
    image: 'https://thumbnail6.coupangcdn.com/thumbnails/remote/230x230ex/image/retail/images/2022/09/22/14/9/f3b2d1e0-5c7a-4e8f-9b2d-1a3c5e7f9b2d.jpg',
    link: 'https://coupa.ng/ckmfT2',
  },
  {
    name: '아이오페 레티놀 엑스퍼트 0.1% 20ml',
    price: '32,000원',
    image: 'https://thumbnail6.coupangcdn.com/thumbnails/remote/230x230ex/image/retail/images/2021/11/05/10/0/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg',
    link: 'https://coupa.ng/ckmfUj',
  },
  {
    name: '곰곰 국내산 닭가슴살 100g x 10팩',
    price: '12,900원',
    image: 'https://thumbnail6.coupangcdn.com/thumbnails/remote/230x230ex/image/retail/images/2023/05/15/09/1/c1d2e3f4-a5b6-c7d8-e9f0-123456789abc.jpg',
    link: 'https://coupa.ng/ckmfVk',
  },
  {
    name: '마몽드 로즈워터 젤 크림 80ml',
    price: '14,500원',
    image: 'https://thumbnail6.coupangcdn.com/thumbnails/remote/230x230ex/image/retail/images/2022/07/19/13/5/d4e5f6a7-b8c9-d0e1-f2a3-b4c5d6e7f8a9.jpg',
    link: 'https://coupa.ng/ckmfWl',
  },
  {
    name: '오뚜기 컵누들 37g x 30개',
    price: '11,900원',
    image: 'https://thumbnail6.coupangcdn.com/thumbnails/remote/230x230ex/image/retail/images/2023/01/20/11/2/e5f6a7b8-c9d0-e1f2-a3b4-c5d6e7f8a9b0.jpg',
    link: 'https://coupa.ng/ckmfXm',
  },
  {
    name: '네이처리퍼블릭 수분크림 100ml',
    price: '7,900원',
    image: 'https://thumbnail6.coupangcdn.com/thumbnails/remote/230x230ex/image/retail/images/2022/03/08/15/7/f6a7b8c9-d0e1-f2a3-b4c5-d6e7f8a9b0c1.jpg',
    link: 'https://coupa.ng/ckmfYn',
  },
  {
    name: '다이소 스킨케어 기초 세트 4종',
    price: '5,000원',
    image: 'https://thumbnail6.coupangcdn.com/thumbnails/remote/230x230ex/image/retail/images/2023/08/11/09/3/a7b8c9d0-e1f2-a3b4-c5d6-e7f8a9b0c1d2.jpg',
    link: 'https://coupa.ng/ckmfZo',
  },
];

let adIndex = 0;

export default function AdCard() {
  // 순환하며 다른 광고 보여주기
  const ad = COUPANG_ADS[adIndex % COUPANG_ADS.length];
  adIndex++;

  return (
    <a
      href={ad.link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr auto auto',
        alignItems: 'center',
        gap: '0 10px',
        padding: '6px 14px',
        borderBottom: '1px solid #f3f4f6',
        background: '#fffbeb',
        textDecoration: 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#fef3c7'}
      onMouseLeave={e => e.currentTarget.style.background = '#fffbeb'}
    >
      {/* 상품 이미지 */}
      <img
        src={ad.image}
        alt={ad.name}
        width={28}
        height={28}
        style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
        onError={e => {
          e.target.style.display = 'none';
        }}
      />

      {/* 상품명 */}
      <span style={{
        fontSize: 12,
        color: '#374151',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        lineHeight: '1.4',
      }}>
        {ad.name}
      </span>

      {/* 가격 */}
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        color: '#d97706',
        whiteSpace: 'nowrap',
        width: 64,
        textAlign: 'right',
        flexShrink: 0,
      }}>
        {ad.price}
      </span>

      {/* AD 뱃지 */}
      <span style={{
        fontSize: 9,
        fontWeight: 700,
        color: '#d97706',
        background: '#fef3c7',
        border: '1px solid #fde68a',
        borderRadius: 3,
        padding: '1px 4px',
        width: 40,
        textAlign: 'center',
        flexShrink: 0,
      }}>
        AD
      </span>
    </a>
  );
}
