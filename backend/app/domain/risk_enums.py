from enum import Enum


class QuestionCategory(str, Enum):
    likelihood = "likelihood"
    impact = "impact"


class AnswerValue(str, Enum):
    no = "no"
    partial = "partial"
    yes = "yes"
    na = "na"
