import { BookOpen, Coffee, Heart, PawPrint, Sparkles, Store } from 'lucide-react'
import { Modal } from './Modal'
import { UiButton } from './UiButton'

export function IntroModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="海风镇宠物咖啡馆"
      subtitle="垂直切片原型 · 一间店，一只猫，一段恋爱，一本剧情书"
      onClose={onClose}
      actions={
        <UiButton variant="primary" block onClick={onClose}>
          开始第一天的营业
        </UiButton>
      }
    >
      <div className="modal__list">
        <p className="modal__item">
          <Coffee size={15} />
          <span>
            <strong>营业关卡</strong>：60–90 秒内接单、制作、上菜、清理，结算金币和经验。
          </span>
        </p>
        <p className="modal__item">
          <Store size={15} />
          <span>
            <strong>咖啡馆经营</strong>：升级设备、研发菜单、采购装饰，都会真实扣金币并改变数值。
          </span>
        </p>
        <p className="modal__item">
          <PawPrint size={15} />
          <span>
            <strong>宠物互动</strong>：喂食、玩耍、梳毛、拍照，每次都会留下一条宠物日记。
          </span>
        </p>
        <p className="modal__item">
          <Heart size={15} />
          <span>
            <strong>恋爱主线</strong>：和林澈一章一章读下去，对白里的选择会改变关系值，关系值决定能不能翻开下一章。
          </span>
        </p>
        <p className="modal__item">
          <BookOpen size={15} />
          <span>
            <strong>剧情本</strong>：独立的新故事集，自己一本、自己一份存档，和恋爱进度互不影响。
          </span>
        </p>
        <p className="modal__item">
          <Sparkles size={15} />
          <span>
            <strong>进度保存</strong>：游客进度只保存在当前浏览器；创建账号后会绑定并上传当前进度，登录账号可在其他设备恢复。右上角可以管理账号和存档。
          </span>
        </p>
      </div>
    </Modal>
  )
}
